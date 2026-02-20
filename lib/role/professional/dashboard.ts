import { prisma } from '@/lib/core/db';
import { BookingStatus, Prisma } from '@prisma/client';
import { ReviewsService } from '@/lib/domain/reviews/service';
import { createResumeUrlSigner } from '@/lib/integrations/resume-storage';

export type ProfessionalDashboardView = 'upcoming' | 'requested' | 'reschedule' | 'pending_feedback';

type BookingWithCandidateResume = {
    candidate: {
        candidateProfile?: {
            resumeUrl?: string | null;
        } | null;
    };
};

type UpcomingBooking = Prisma.BookingGetPayload<{
    select: {
        id: true;
        startAt: true;
        timezone: true;
        zoomJoinUrl: true;
        candidate: {
            select: {
                email: true;
            };
        };
    };
}>;

type RequestBooking = Prisma.BookingGetPayload<{
    include: {
        candidate: {
            include: {
                candidateProfile: true;
            };
        };
    };
}>;

type PendingFeedbackBooking = Prisma.BookingGetPayload<{
    include: {
        candidate: {
            select: {
                id: true;
                email: true;
            };
        };
        feedback: {
            select: {
                qcStatus: true;
                actions: true;
            };
        };
    };
}>;

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

async function signActionRequiredResumeUrls(bookings: BookingWithCandidateResume[]) {
    const signResumeUrl = createResumeUrlSigner();

    await Promise.all(
        bookings.map(async (booking) => {
            const candidateProfile = booking.candidate.candidateProfile;
            if (!candidateProfile?.resumeUrl) return;

            candidateProfile.resumeUrl = (await signResumeUrl(candidateProfile.resumeUrl)) ?? null;
        }),
    );
}

function nextCursorFromPage<T extends { id: string }>(items: T[], take: number) {
    const hasMore = items.length > take;
    const pageItems = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id : undefined;

    return { hasMore, pageItems, nextCursor };
}

async function getActiveViewPage(
    professionalId: string,
    view: ProfessionalDashboardView,
    take: number,
    cursor?: string,
) {
    if (view === 'upcoming') {
        const items = await prisma.booking.findMany({
            where: {
                professionalId,
                status: BookingStatus.accepted,
            },
            select: {
                id: true,
                startAt: true,
                timezone: true,
                zoomJoinUrl: true,
                candidate: {
                    select: {
                        email: true,
                    },
                },
            },
            orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        return nextCursorFromPage(items, take);
    }

    if (view === 'requested') {
        const items = await prisma.booking.findMany({
            where: {
                professionalId,
                status: BookingStatus.requested,
            },
            include: {
                candidate: {
                    include: {
                        candidateProfile: true,
                    },
                },
            },
            orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const page = nextCursorFromPage(items, take);
        await signActionRequiredResumeUrls(page.pageItems);
        return page;
    }

    if (view === 'reschedule') {
        const items = await prisma.booking.findMany({
            where: {
                professionalId,
                status: BookingStatus.reschedule_pending,
            },
            include: {
                candidate: {
                    include: {
                        candidateProfile: true,
                    },
                },
            },
            orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
            take: take + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

        const page = nextCursorFromPage(items, take);
        await signActionRequiredResumeUrls(page.pageItems);
        return page;
    }

    const items = await prisma.booking.findMany({
        where: pendingFeedbackWhere(professionalId),
        include: {
            candidate: {
                select: {
                    id: true,
                    email: true,
                },
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

    return nextCursorFromPage(items, take);
}

export const ProfessionalDashboardService = {
    isDashboardView(value: string | undefined): value is ProfessionalDashboardView {
        if (!value) return false;
        return DASHBOARD_VIEWS.includes(value as ProfessionalDashboardView);
    },

    async getDashboardData(professionalId: string, options: DashboardOptions) {
        const take = getPageSize(options.take);
        const startedAt = performance.now();
        const activeViewPromise = getActiveViewPage(professionalId, options.view, take, options.cursor).catch(
            async (error) => {
                if (options.cursor && isInvalidCursorError(error)) {
                    // Fallback to first page when cursor is stale/invalid.
                    return getActiveViewPage(professionalId, options.view, take);
                }

                throw error;
            },
        );

        const [bookingsCount, pendingFeedbackCount, recentFeedbackData, activeViewPage] = await Promise.all([
            prisma.booking.groupBy({
                by: ['status'],
                where: {
                    professionalId,
                },
                _count: { _all: true },
            }),
            prisma.booking.count({
                where: pendingFeedbackWhere(professionalId),
            }),
            ReviewsService.getProfessionalReviews(professionalId, { take: 5 }),
            activeViewPromise,
        ]);

        const sectionCounts: Record<ProfessionalDashboardView, number> = {
            upcoming: bookingsCount.find((item) => item.status === BookingStatus.accepted)?._count._all || 0,
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
            recentFeedback: recentFeedbackData.reviews,
            reviewStats: recentFeedbackData.stats,
        };
    },
};
