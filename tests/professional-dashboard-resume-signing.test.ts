import { beforeEach, describe, expect, it, vi } from "vitest";
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
        mockPrisma.user.findUnique.mockResolvedValue({ timezone: "UTC" });
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
                priceCents: 10000,
                expiresAt: new Date("2026-03-01T00:00:00Z"),
                candidate: {
                    firstName: "Morgan",
                    lastName: "Reed",
                    candidateProfile: {
                        resumeUrl:
                            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf",
                        experience: [
                            {
                                id: "exp-1",
                                title: "Associate",
                                company: "Evercore",
                                startDate: new Date("2025-01-01"),
                                endDate: null,
                                isCurrent: true,
                            },
                        ],
                        education: [
                            {
                                id: "edu-1",
                                school: "Yale University",
                                startDate: new Date("2021-09-01"),
                                endDate: null,
                                isCurrent: true,
                            },
                        ],
                    },
                },
            },
            {
                id: "requested-2",
                status: BookingStatus.requested,
                priceCents: 10000,
                expiresAt: new Date("2026-03-02T00:00:00Z"),
                candidate: {
                    firstName: "Jordan",
                    lastName: "Pruitt",
                    candidateProfile: {
                        resumeUrl: "https://legacy-storage.example.com/resumes/cand-2/resume.pdf",
                        experience: [],
                        education: [],
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
        expect((data.items[0] as { candidateLabel: string }).candidateLabel).toBe(
            "Morgan Reed - Yale University, Associate @ Evercore"
        );
        expect(mockPrisma.booking.findMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({
                    status: BookingStatus.requested,
                }),
                select: expect.objectContaining({
                    candidate: expect.objectContaining({
                        select: expect.objectContaining({
                            candidateProfile: expect.objectContaining({
                                select: expect.objectContaining({
                                    resumeUrl: true,
                                }),
                            }),
                        }),
                    }),
                }),
            })
        );
        expect(data.professionalTimezone).toBe("UTC");
    });
});
