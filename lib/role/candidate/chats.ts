import { prisma } from "@/lib/core/db";
import { deriveCurrentRoleFromExperiences } from "@/lib/domain/users/current-role";
import { BookingStatus, Prisma } from "@prisma/client";

export type CandidateChatSection = "upcoming" | "pending" | "expired" | "past" | "other";

const DEFAULT_CHAT_PAGE_SIZE = 12;
const MAX_CHAT_PAGE_SIZE = 50;

const KNOWN_STATUSES: BookingStatus[] = [
    BookingStatus.accepted,
    BookingStatus.accepted_pending_integrations,
    BookingStatus.draft,
    BookingStatus.requested,
    BookingStatus.reschedule_pending,
    BookingStatus.dispute_pending,
    BookingStatus.expired,
    BookingStatus.completed,
    BookingStatus.completed_pending_feedback,
    BookingStatus.cancelled,
    BookingStatus.declined,
    BookingStatus.refunded,
];

const STATUS_BY_SECTION: Record<CandidateChatSection, BookingStatus[]> = {
    upcoming: [BookingStatus.accepted, BookingStatus.accepted_pending_integrations],
    pending: [BookingStatus.draft, BookingStatus.requested, BookingStatus.reschedule_pending, BookingStatus.dispute_pending],
    expired: [BookingStatus.expired],
    past: [BookingStatus.completed, BookingStatus.completed_pending_feedback, BookingStatus.cancelled, BookingStatus.declined, BookingStatus.refunded],
    other: [],
};

const candidateChatInclude = {
    professional: {
        include: {
            professionalProfile: {
                include: {
                    experience: {
                        where: { type: "EXPERIENCE" },
                        orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
                    },
                },
            },
        },
    },
    payment: true,
    feedback: true,
} satisfies Prisma.BookingInclude;

type CandidateChatBookingRaw = Prisma.BookingGetPayload<{
    include: typeof candidateChatInclude;
}>;

type ProfessionalProfileWithRole = NonNullable<
    CandidateChatBookingRaw["professional"]["professionalProfile"]
> & {
    title: string | null;
    employer: string | null;
};

export type CandidateChatBooking = Omit<CandidateChatBookingRaw, "professional"> & {
    professional: Omit<CandidateChatBookingRaw["professional"], "professionalProfile"> & {
        professionalProfile: ProfessionalProfileWithRole | null;
    };
};

function withDerivedProfessionalRole(booking: CandidateChatBookingRaw): CandidateChatBooking {
    if (!booking.professional) {
        return booking as unknown as CandidateChatBooking;
    }

    const profile = booking.professional.professionalProfile;
    if (!profile) {
        return {
            ...booking,
            professional: {
                ...booking.professional,
                professionalProfile: null,
            },
        };
    }

    const role = deriveCurrentRoleFromExperiences(profile.experience);

    return {
        ...booking,
        professional: {
            ...booking.professional,
            professionalProfile: {
                ...profile,
                title: role.title,
                employer: role.employer,
            },
        },
    };
}

function getPageSize(take: number | undefined) {
    if (typeof take !== "number" || Number.isNaN(take)) {
        return DEFAULT_CHAT_PAGE_SIZE;
    }

    return Math.min(Math.max(Math.floor(take), 1), MAX_CHAT_PAGE_SIZE);
}

export function getCandidateChatSectionFromStatus(status: BookingStatus): CandidateChatSection {
    if (STATUS_BY_SECTION.upcoming.includes(status)) return "upcoming";
    if (STATUS_BY_SECTION.pending.includes(status)) return "pending";
    if (STATUS_BY_SECTION.expired.includes(status)) return "expired";
    if (STATUS_BY_SECTION.past.includes(status)) return "past";
    return "other";
}

function buildSectionWhere(candidateId: string, section: CandidateChatSection): Prisma.BookingWhereInput {
    if (section === "other") {
        return {
            candidateId,
            status: {
                notIn: KNOWN_STATUSES,
            },
        };
    }

    return {
        candidateId,
        status: {
            in: STATUS_BY_SECTION[section],
        },
    };
}

function buildSectionOrderBy(section: CandidateChatSection): Prisma.BookingOrderByWithRelationInput[] {
    if (section === "upcoming") {
        return [{ startAt: "asc" }, { expiresAt: "asc" }, { id: "asc" }];
    }

    if (section === "pending") {
        return [{ expiresAt: "asc" }, { startAt: "asc" }, { id: "asc" }];
    }

    return [{ endAt: "desc" }, { startAt: "desc" }, { expiresAt: "desc" }, { id: "desc" }];
}

function isInvalidCursorError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function getCandidateChatSectionCounts(candidateId: string): Promise<Record<CandidateChatSection, number>> {
    const startedAt = performance.now();
    const grouped = await prisma.booking.groupBy({
        by: ["status"],
        where: { candidateId },
        _count: { _all: true },
    });

    const counts: Record<CandidateChatSection, number> = {
        upcoming: 0,
        pending: 0,
        expired: 0,
        past: 0,
        other: 0,
    };

    for (const item of grouped) {
        counts[getCandidateChatSectionFromStatus(item.status)] += item._count._all;
    }

    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    console.info("[perf][candidate-history] getCandidateChatSectionCounts", {
        rows: grouped.length,
        durationMs,
    });

    return counts;
}

export async function getCandidateChatSectionPage(
    candidateId: string,
    section: CandidateChatSection,
    options: { take?: number; cursor?: string } = {}
): Promise<{ items: CandidateChatBooking[]; nextCursor?: string }> {
    const take = getPageSize(options.take);
    const startedAt = performance.now();
    const buildQuery = (cursor?: string) => ({
        where: buildSectionWhere(candidateId, section),
        include: candidateChatInclude,
        orderBy: buildSectionOrderBy(section),
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    let items: CandidateChatBookingRaw[];

    try {
        items = await prisma.booking.findMany(buildQuery(options.cursor));
    } catch (error) {
        if (options.cursor && isInvalidCursorError(error)) {
            items = await prisma.booking.findMany(buildQuery());
        } else {
            throw error;
        }
    }

    const hasMore = items.length > take;
    const pageItems = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? pageItems[pageItems.length - 1]?.id : undefined;
    const durationMs = Number((performance.now() - startedAt).toFixed(2));

    console.info("[perf][candidate-history] getCandidateChatSectionPage", {
        section,
        take,
        hasCursor: Boolean(options.cursor),
        rows: pageItems.length,
        hasMore,
        durationMs,
    });

    return {
        items: pageItems.map(withDerivedProfessionalRole),
        nextCursor,
    };
}

export async function getCandidateBookingDetails(bookingId: string, candidateId: string) {
    const booking = await prisma.booking.findUnique({
        where: {
            id: bookingId,
            candidateId,
        },
        include: {
            professional: {
                include: {
                    professionalProfile: {
                        include: {
                            experience: {
                                where: { type: "EXPERIENCE" },
                                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
                            },
                        },
                    },
                },
            },
            payment: true,
            feedback: true,
        },
    });

    if (!booking) {
        return null;
    }

    return withDerivedProfessionalRole(booking);
}
