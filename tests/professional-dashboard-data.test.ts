import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
}));

const getProfessionalReviewsMock = vi.hoisted(() => vi.fn());
const createResumeUrlSignerMock = vi.hoisted(() => vi.fn());
const FROZEN_NOW = new Date("2026-03-01T12:00:00Z");

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/domain/reviews/service", () => ({
    ReviewsService: {
        getProfessionalReviews: getProfessionalReviewsMock,
    },
}));

vi.mock("@/lib/integrations/resume-storage", () => ({
    createResumeUrlSigner: createResumeUrlSignerMock,
}));

import { ProfessionalDashboardService } from "@/lib/role/professional/dashboard";

describe("ProfessionalDashboardService.getDashboardData", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FROZEN_NOW);
        vi.clearAllMocks();
        mockPrisma.booking.groupBy.mockResolvedValue([
            { status: BookingStatus.accepted, _count: { _all: 4 } },
            { status: BookingStatus.requested, _count: { _all: 2 } },
            { status: BookingStatus.reschedule_pending, _count: { _all: 1 } },
        ]);
        mockPrisma.booking.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
        mockPrisma.user.findUnique.mockResolvedValue({ timezone: "America/New_York" });
        getProfessionalReviewsMock.mockResolvedValue({
            reviews: [],
            stats: { average: 4.5, count: 9 },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("loads only the active view query and returns section counts", async () => {
        mockPrisma.booking.findMany.mockResolvedValue([
            {
                id: "upcoming-1",
                startAt: new Date(),
                timezone: "America/New_York",
                zoomJoinUrl: "https://zoom.us/j/1",
                professionalZoomJoinUrl: "https://zoom.us/wc/1",
                candidate: {
                    firstName: "John",
                    lastName: "Doe",
                    candidateProfile: {
                        resumeUrl: null,
                        experience: [
                            {
                                id: "exp-1",
                                title: "Intern",
                                company: "Blackstone",
                                startDate: new Date("2025-01-01"),
                                endDate: null,
                                isCurrent: true,
                            },
                        ],
                        education: [
                            {
                                id: "edu-1",
                                school: "Columbia University",
                                startDate: new Date("2022-09-01"),
                                endDate: null,
                                isCurrent: true,
                            },
                        ],
                    },
                },
            },
        ]);

        const data = await ProfessionalDashboardService.getDashboardData("pro-1", {
            view: "upcoming",
            take: 10,
        });

        expect(mockPrisma.booking.findMany).toHaveBeenCalledTimes(1);
        expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    professionalId: "pro-1",
                    status: BookingStatus.accepted,
                    startAt: { gte: FROZEN_NOW },
                },
                orderBy: [{ startAt: "asc" }, { id: "asc" }],
            }),
        );
        expect(mockPrisma.booking.count).toHaveBeenNthCalledWith(1, {
            where: {
                professionalId: "pro-1",
                status: BookingStatus.accepted,
                startAt: { gte: FROZEN_NOW },
            },
        });
        expect(data.sectionCounts).toEqual({
            upcoming: 4,
            requested: 2,
            reschedule: 1,
            pending_feedback: 3,
        });
        expect(data.stats).toEqual({
            upcomingBookingsCount: 4,
            pendingFeedbackCount: 3,
        });
        expect(data.professionalTimezone).toBe("America/New_York");
        expect((data.items[0] as { candidateLabel: string }).candidateLabel).toBe(
            "John Doe - Columbia University, Intern @ Blackstone"
        );
    });

    it("paginates pending feedback section", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ timezone: "Mars/Olympus" });
        mockPrisma.booking.findMany.mockResolvedValue([
            {
                id: "f1",
                endAt: new Date("2026-02-20T00:00:00Z"),
                candidate: {
                    firstName: "Casey",
                    lastName: "Lee",
                    candidateProfile: {
                        resumeUrl: null,
                        experience: [
                            {
                                id: "exp-2",
                                title: "Analyst",
                                company: "Centerview",
                                startDate: new Date("2024-01-01"),
                                endDate: null,
                                isCurrent: true,
                            },
                        ],
                        education: [],
                    },
                },
                feedback: null,
            },
            {
                id: "f2",
                endAt: new Date("2026-02-19T00:00:00Z"),
                candidate: {
                    firstName: "Jamie",
                    lastName: "Park",
                    candidateProfile: {
                        resumeUrl: null,
                        experience: [],
                        education: [],
                    },
                },
                feedback: null,
            },
        ]);

        const data = await ProfessionalDashboardService.getDashboardData("pro-1", {
            view: "pending_feedback",
            take: 1,
        });

        expect(data.items).toHaveLength(1);
        expect(data.nextCursor).toBe("f1");
        expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 2,
                orderBy: [{ endAt: "desc" }, { id: "desc" }],
            }),
        );
        expect(data.professionalTimezone).toBe("UTC");
        expect((data.items[0] as { candidateLabel: string }).candidateLabel).toBe("Casey Lee - Analyst @ Centerview");
    });
});
