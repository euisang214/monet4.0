import { prisma } from '@/lib/core/db';
import { BookingStatus, Prisma } from '@prisma/client';
import { ReviewsService } from '@/lib/domain/reviews/service';
import { formatCandidateForProfessionalView } from '@/lib/domain/users/identity-labels';
import { signCandidateResumeUrls } from '@/lib/shared/resume-signing';
import { normalizeTimezone } from '@/lib/utils/supported-timezones';

export type ProfessionalDashboardView = 'upcoming' | 'requested' | 'reschedule' | 'pending_feedback';

const candidateIdentitySelect = {
    firstName: true,
    lastName: true,
    candidateProfile: {
        select: {
            resumeUrl: true,
            experience: {
                where: { type: 'EXPERIENCE' },
                orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                select: {
                    id: true,
                    title: true,
                    company: true,
                    startDate: true,
                    endDate: true,
                    isCurrent: true,
                },
            },
            education: {
                orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                select: {
                    id: true,
                    school: true,
                    startDate: true,
                    endDate: true,
                    isCurrent: true,
                },
            },
        },
    },
} satisfies Prisma.UserSelect;

type CandidateIdentity = Prisma.UserGetPayload<{
    select: typeof candidateIdentitySelect;
}>;

export type UpcomingBooking = {
    id: string;
    startAt: Date | null;
    timezone: string;
    zoomJoinUrl: string | null;
    professionalZoomJoinUrl: string | null;
    candidateLabel: string;
};

export type RequestBooking = {
    id: string;
    status: BookingStatus;
    priceCents: number | null;
    expiresAt: Date | null;
    candidateLabel: string;
    candidate: {
        candidateProfile: {
            resumeUrl: string | null;
        } | null;
    };
};

export type PendingFeedbackBooking = {
    id: string;
    endAt: Date | null;
    candidateLabel: string;
    feedback: {
        qcStatus: string;
        actions: string[];
    } | null;
};

export type ProfessionalDashboardItem = UpcomingBooking | RequestBooking | PendingFeedbackBooking;

type DashboardOptions = {
    view: ProfessionalDashboardView;
    take?: number;
    cursor?: string;
};

const DEFAULT_DASHBOARD_PAGE_SIZE = 10;
const MAX_DASHBOARD_PAGE_SIZE = 50;

const DASHBOARD_VIEWS: ProfessionalDashboardView[] = ['upcoming', 'requested', 'reschedule', 'pending_feedback'];

function getPageSize(take: number | undefined) {
    if (typeof take !== 'number' || Number.isNaN(take)) {
        return DEFAULT_DASHBOARD_PAGE_SIZE;
    }

    return Math.min(Math.max(Math.floor(take), 1), MAX_DASHBOARD_PAGE_SIZE);
}

function isInvalidCursorError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

function pendingFeedbackWhere(professionalId: string): Prisma.BookingWhereInput {
    return {
        professionalId,
        status: BookingStatus.completed_pending_feedback,
        OR: [
            { feedback: { is: null } },
            { feedback: { qcStatus: { not: 'passed' } } },
        ],
    };
}

function upcomingWhere(professionalId: string, now: Date): Prisma.BookingWhereInput {
    return {
        professionalId,
        status: BookingStatus.accepted,
        startAt: { gte: now },
    };
}

function nextCursorFromPage<T extends { id: string }>(items: T[], take: number) {
    const hasMore = items.length > take;
    const pageItems = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id : undefined;

    return { hasMore, pageItems, nextCursor };
}

function formatCandidateLabel(candidate: CandidateIdentity) {
    return formatCandidateForProfessionalView({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        experience: candidate.candidateProfile?.experience ?? [],
        education: candidate.candidateProfile?.education ?? [],
    });
}

async function getActiveViewPage(
    professionalId: string,
    view: ProfessionalDashboardView,
    take: number,
    now: Date,
    cursor?: string,
) {
    if (view === 'upcoming') {
        const items = await prisma.booking.findMany({
            where: upcomingWhere(professionalId, now),
            select: {
                id: true,
                startAt: true,
                timezone: true,
                zoomJoinUrl: true,
                professionalZoomJoinUrl: true,
                candidate: {
                    select: candidateIdentitySelect,
                },
            },
            orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const page = nextCursorFromPage(items, take);
        return {
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            pageItems: page.pageItems.map((item) => ({
                id: item.id,
                startAt: item.startAt,
                timezone: item.timezone,
                zoomJoinUrl: item.zoomJoinUrl,
                professionalZoomJoinUrl: item.professionalZoomJoinUrl,
                candidateLabel: formatCandidateLabel(item.candidate),
            })),
        };
    }

    if (view === 'requested') {
        const items = await prisma.booking.findMany({
            where: {
                professionalId,
                status: BookingStatus.requested,
            },
            select: {
                id: true,
                status: true,
                priceCents: true,
                expiresAt: true,
                candidate: {
                    select: candidateIdentitySelect,
                },
            },
            orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const page = nextCursorFromPage(items, take);
        await signCandidateResumeUrls(page.pageItems);
        return {
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            pageItems: page.pageItems.map((item) => ({
                id: item.id,
                status: item.status,
                priceCents: item.priceCents,
                expiresAt: item.expiresAt,
                candidateLabel: formatCandidateLabel(item.candidate),
                candidate: {
                    candidateProfile: item.candidate.candidateProfile
                        ? { resumeUrl: item.candidate.candidateProfile.resumeUrl }
                        : null,
                },
            })),
        };
    }

    if (view === 'reschedule') {
        const items = await prisma.booking.findMany({
            where: {
                professionalId,
                status: BookingStatus.reschedule_pending,
            },
            select: {
                id: true,
                status: true,
                priceCents: true,
                expiresAt: true,
                candidate: {
                    select: candidateIdentitySelect,
                },
            },
            orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const page = nextCursorFromPage(items, take);
        await signCandidateResumeUrls(page.pageItems);
        return {
            hasMore: page.hasMore,
            nextCursor: page.nextCursor,
            pageItems: page.pageItems.map((item) => ({
                id: item.id,
                status: item.status,
                priceCents: item.priceCents,
                expiresAt: item.expiresAt,
                candidateLabel: formatCandidateLabel(item.candidate),
                candidate: {
                    candidateProfile: item.candidate.candidateProfile
                        ? { resumeUrl: item.candidate.candidateProfile.resumeUrl }
                        : null,
                },
            })),
        };
    }

    const items = await prisma.booking.findMany({
        where: pendingFeedbackWhere(professionalId),
        select: {
            id: true,
            endAt: true,
            candidate: {
                select: candidateIdentitySelect,
            },
            feedback: {
                select: {
                    qcStatus: true,
                    actions: true,
                },
            },
        },
        orderBy: [{ endAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const page = nextCursorFromPage(items, take);
    return {
        hasMore: page.hasMore,
        nextCursor: page.nextCursor,
        pageItems: page.pageItems.map((item) => ({
            id: item.id,
            endAt: item.endAt,
            candidateLabel: formatCandidateLabel(item.candidate),
            feedback: item.feedback,
        })),
    };
}

export const ProfessionalDashboardService = {
    isDashboardView(value: string | undefined): value is ProfessionalDashboardView {
        if (!value) return false;
        return DASHBOARD_VIEWS.includes(value as ProfessionalDashboardView);
    },

    async getDashboardData(professionalId: string, options: DashboardOptions) {
        const take = getPageSize(options.take);
        const startedAt = performance.now();
        const now = new Date();
        const activeViewPromise = getActiveViewPage(professionalId, options.view, take, now, options.cursor).catch(
            async (error) => {
                if (options.cursor && isInvalidCursorError(error)) {
                    // Fallback to first page when cursor is stale/invalid.
                    return getActiveViewPage(professionalId, options.view, take, now);
                }

                throw error;
            },
        );

        const [bookingsCount, upcomingVisibleCount, pendingFeedbackCount, recentFeedbackData, activeViewPage, professional] =
            await Promise.all([
                prisma.booking.groupBy({
                    by: ['status'],
                    where: {
                        professionalId,
                    },
                    _count: { _all: true },
                }),
                prisma.booking.count({
                    where: upcomingWhere(professionalId, now),
                }),
                prisma.booking.count({
                    where: pendingFeedbackWhere(professionalId),
                }),
                ReviewsService.getProfessionalReviews(professionalId, { take: 5 }),
                activeViewPromise,
                prisma.user.findUnique({
                    where: { id: professionalId },
                    select: { timezone: true },
                }),
            ]);

        const professionalTimezone = normalizeTimezone(professional?.timezone);

        const sectionCounts: Record<ProfessionalDashboardView, number> = {
            upcoming: upcomingVisibleCount,
            requested: bookingsCount.find((item) => item.status === BookingStatus.requested)?._count._all || 0,
            reschedule: bookingsCount.find((item) => item.status === BookingStatus.reschedule_pending)?._count._all || 0,
            pending_feedback: pendingFeedbackCount,
        };

        const durationMs = Number((performance.now() - startedAt).toFixed(2));
        console.info('[perf][professional-dashboard] getDashboardData', {
            view: options.view,
            take,
            hasCursor: Boolean(options.cursor),
            rows: activeViewPage.pageItems.length,
            hasMore: activeViewPage.hasMore,
            durationMs,
        });

        return {
            stats: {
                pendingFeedbackCount: sectionCounts.pending_feedback,
                upcomingBookingsCount: sectionCounts.upcoming,
            },
            sectionCounts,
            activeView: options.view,
            items: activeViewPage.pageItems as ProfessionalDashboardItem[],
            nextCursor: activeViewPage.nextCursor,
            professionalTimezone,
            recentFeedback: recentFeedbackData.reviews,
            reviewStats: recentFeedbackData.stats,
        };
    },
};
