import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        findUnique: vi.fn(),
    },
}));

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

import {
    getCandidateChatSectionCounts,
    getCandidateChatSectionFromStatus,
    getCandidateChatSectionPage,
} from "@/lib/role/candidate/chats";

describe("candidate chat pagination", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("maps statuses to section counts", async () => {
        mockPrisma.booking.groupBy.mockResolvedValue([
            { status: BookingStatus.accepted, _count: { _all: 2 } },
            { status: BookingStatus.requested, _count: { _all: 1 } },
            { status: BookingStatus.completed, _count: { _all: 3 } },
            { status: "unexpected_status", _count: { _all: 4 } },
        ]);

        const counts = await getCandidateChatSectionCounts("cand-1");

        expect(counts).toEqual({
            upcoming: 2,
            pending: 1,
            expired: 0,
            past: 3,
            other: 4,
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
        expect(page.items[0]?.professional.professionalProfile?.title).toBe("Principal");
        expect(page.items[0]?.professional.professionalProfile?.employer).toBe("Monet");
        expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 3,
                orderBy: [{ expiresAt: "asc" }, { startAt: "asc" }, { id: "asc" }],
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
});
