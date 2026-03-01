import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
}));

const FROZEN_NOW = new Date("2026-03-01T12:00:00Z");

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

import {
    getCandidateBookingDetails,
    getCandidateChatSectionCounts,
    getCandidateChatSectionFromStatus,
    getCandidateChatSectionPage,
} from "@/lib/role/candidate/chats";

describe("candidate chat pagination", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FROZEN_NOW);
        vi.clearAllMocks();
        mockPrisma.booking.count.mockResolvedValue(0);
        mockPrisma.user.findUnique.mockResolvedValue({ timezone: "America/New_York" });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("maps statuses to section counts with upcoming aligned to visible future calls", async () => {
        mockPrisma.booking.groupBy.mockResolvedValue([
            { status: BookingStatus.accepted, _count: { _all: 2 } },
            { status: BookingStatus.requested, _count: { _all: 1 } },
            { status: BookingStatus.completed, _count: { _all: 3 } },
            { status: "unexpected_status", _count: { _all: 4 } },
        ]);
        mockPrisma.booking.count.mockResolvedValueOnce(1);

        const counts = await getCandidateChatSectionCounts("cand-1");

        expect(counts).toEqual({
            upcoming: 1,
            pending: 1,
            expired: 0,
            past: 3,
            other: 4,
        });
        expect(mockPrisma.booking.count).toHaveBeenCalledWith({
            where: {
                candidateId: "cand-1",
                status: {
                    in: [BookingStatus.accepted, BookingStatus.accepted_pending_integrations],
                },
                startAt: { gte: FROZEN_NOW },
            },
        });
    });

    it("returns paginated items and nextCursor", async () => {
        mockPrisma.booking.findMany.mockResolvedValue([
            {
                id: "booking-1",
                status: BookingStatus.requested,
                professional: {
                    professionalProfile: {
                        experience: [
                            {
                                id: "exp-1",
                                title: "Principal",
                                company: "Monet",
                                isCurrent: true,
                                startDate: new Date("2024-01-01"),
                            },
                        ],
                    },
                },
            },
            {
                id: "booking-2",
                status: BookingStatus.requested,
                professional: {
                    professionalProfile: {
                        experience: [
                            {
                                id: "exp-2",
                                title: "Director",
                                company: "Org 2",
                                isCurrent: true,
                                startDate: new Date("2023-01-01"),
                            },
                        ],
                    },
                },
            },
            {
                id: "booking-3",
                status: BookingStatus.requested,
                professional: {
                    professionalProfile: {
                        experience: [
                            {
                                id: "exp-3",
                                title: "VP",
                                company: "Org 3",
                                isCurrent: true,
                                startDate: new Date("2022-01-01"),
                            },
                        ],
                    },
                },
            },
        ]);

        const page = await getCandidateChatSectionPage("cand-1", "pending", {
            take: 2,
        });

        expect(page.items).toHaveLength(2);
        expect(page.nextCursor).toBe("booking-2");
        expect(page.candidateTimezone).toBe("America/New_York");
        expect(page.items[0]?.professional.professionalProfile?.title).toBe("Principal");
        expect(page.items[0]?.professional.professionalProfile?.employer).toBe("Monet");
        expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 3,
                orderBy: [{ expiresAt: "asc" }, { startAt: "asc" }, { id: "asc" }],
            }),
        );
    });

    it("applies future-only filtering and soonest-first ordering for upcoming section", async () => {
        mockPrisma.booking.findMany.mockResolvedValue([]);

        await getCandidateChatSectionPage("cand-1", "upcoming", {
            take: 2,
        });

        expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    candidateId: "cand-1",
                    status: {
                        in: [BookingStatus.accepted, BookingStatus.accepted_pending_integrations],
                    },
                    startAt: { gte: FROZEN_NOW },
                },
                take: 3,
                orderBy: [{ startAt: "asc" }, { id: "asc" }],
            }),
        );
    });

    it("uses notIn filtering for the other section", async () => {
        mockPrisma.booking.findMany.mockResolvedValue([]);

        await getCandidateChatSectionPage("cand-1", "other");

        const query = mockPrisma.booking.findMany.mock.calls[0][0];
        expect(query.where.status.notIn).toContain(BookingStatus.accepted);
        expect(query.where.status.notIn).toContain(BookingStatus.requested);
    });

    it("maps unknown status to other section", () => {
        expect(getCandidateChatSectionFromStatus("made_up_status" as BookingStatus)).toBe("other");
    });

    it("includes feedback when fetching booking details", async () => {
        mockPrisma.booking.findUnique.mockResolvedValue(null);

        await getCandidateBookingDetails("booking-1", "cand-1");

        expect(mockPrisma.booking.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: "booking-1",
                    candidateId: "cand-1",
                },
                include: expect.objectContaining({
                    feedback: true,
                }),
            }),
        );
    });
});
