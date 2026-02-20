import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingStatus } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
        groupBy: vi.fn(),
    },
}));

const getPendingFeedbackMock = vi.hoisted(() => vi.fn());
const getProfessionalReviewsMock = vi.hoisted(() => vi.fn());
const signResumeUrlMock = vi.hoisted(() => vi.fn());
const createResumeUrlSignerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/role/professional/feedback", () => ({
    ProfessionalFeedbackService: {
        getPendingFeedback: getPendingFeedbackMock,
    },
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

describe("ProfessionalDashboardService resume signing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createResumeUrlSignerMock.mockReturnValue(signResumeUrlMock);
        signResumeUrlMock.mockImplementation(async (url: string | null | undefined) => {
            if (!url) return url;

            return url.includes("/storage/v1/object/candidate-resumes/")
                ? `${url}?signed=1`
                : url;
        });
        getPendingFeedbackMock.mockResolvedValue([]);
        getProfessionalReviewsMock.mockResolvedValue({
            reviews: [],
            stats: { average: null, count: 0 },
        });
    });

    it("signs action-required candidate resume URLs", async () => {
        mockPrisma.booking.findMany
            .mockResolvedValueOnce([
                {
                    id: "requested-1",
                    status: BookingStatus.requested,
                    candidate: {
                        candidateProfile: {
                            resumeUrl:
                                "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf",
                        },
                    },
                },
                {
                    id: "requested-2",
                    status: BookingStatus.requested,
                    candidate: {
                        candidateProfile: {
                            resumeUrl: "https://legacy-storage.example.com/resumes/cand-2/resume.pdf",
                        },
                    },
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: "upcoming-1",
                    startAt: new Date(),
                    timezone: "America/New_York",
                    zoomJoinUrl: "https://zoom.us/j/123",
                    candidate: { email: "cand1@example.com" },
                },
            ]);

        const data = await ProfessionalDashboardService.getDashboardBookings("pro-1");

        expect(createResumeUrlSignerMock).toHaveBeenCalledTimes(1);
        expect(data.actionRequired[0].candidate.candidateProfile?.resumeUrl).toBe(
            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf?signed=1"
        );
        expect(data.actionRequired[1].candidate.candidateProfile?.resumeUrl).toBe(
            "https://legacy-storage.example.com/resumes/cand-2/resume.pdf"
        );
        expect(mockPrisma.booking.findMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                select: expect.objectContaining({
                    professionalZoomJoinUrl: true,
                    zoomJoinUrl: true,
                }),
            })
        );
    });
});
