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
const signResumeUrlMock = vi.hoisted(() => vi.fn());
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
        mockPrisma.booking.groupBy.mockResolvedValue([]);
        mockPrisma.booking.count.mockResolvedValue(0);
        getProfessionalReviewsMock.mockResolvedValue({
            reviews: [],
            stats: { average: null, count: 0 },
        });
    });

    it("signs requested candidate resume URLs and only fetches the active section", async () => {
        mockPrisma.booking.findMany.mockResolvedValue([
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
        ]);

        const data = await ProfessionalDashboardService.getDashboardData("pro-1", {
            view: "requested",
        });
        const requestedItems = data.items as Array<{
            candidate: {
                candidateProfile?: {
                    resumeUrl?: string | null;
                } | null;
            };
        }>;

        expect(createResumeUrlSignerMock).toHaveBeenCalledTimes(1);
        expect(mockPrisma.booking.findMany).toHaveBeenCalledTimes(1);
        expect(requestedItems[0].candidate.candidateProfile?.resumeUrl).toBe(
            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf?signed=1"
        );
        expect(requestedItems[1].candidate.candidateProfile?.resumeUrl).toBe(
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
