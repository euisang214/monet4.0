import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
        count: vi.fn(),
    },
}));

const getProfessionalReviewsMock = vi.hoisted(() => vi.fn());
const createResumeUrlSignerMock = vi.hoisted(() => vi.fn());

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
        vi.clearAllMocks();
        mockPrisma.booking.groupBy.mockResolvedValue([
            { status: BookingStatus.accepted, _count: { _all: 4 } },
            { status: BookingStatus.requested, _count: { _all: 2 } },
            { status: BookingStatus.reschedule_pending, _count: { _all: 1 } },
        ]);
        mockPrisma.booking.count.mockResolvedValue(3);
        getProfessionalReviewsMock.mockResolvedValue({
            reviews: [],
            stats: { average: 4.5, count: 9 },
        });
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
        expect((data.items[0] as { candidateLabel: string }).candidateLabel).toBe(
            "John Doe - Columbia University, Intern @ Blackstone"
        );
    });

    it("paginates pending feedback section", async () => {
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
        expect((data.items[0] as { candidateLabel: string }).candidateLabel).toBe("Casey Lee - Analyst @ Centerview");
    });
});
