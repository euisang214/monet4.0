import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
    },
}));

const signResumeUrlMock = vi.hoisted(() => vi.fn());
const createResumeUrlSignerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/integrations/resume-storage", () => ({
    createResumeUrlSigner: createResumeUrlSignerMock,
}));

import { getPendingRequests } from "@/lib/shared/bookings/upcoming";

describe("upcoming bookings resume signing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createResumeUrlSignerMock.mockReturnValue(signResumeUrlMock);
        signResumeUrlMock.mockImplementation(async (url: string | null | undefined) => {
            if (!url) return url;

            return url.includes("/storage/v1/object/candidate-resumes/")
                ? `${url}?signed=1`
                : url;
        });
    });

    it("signs Supabase resume URLs and leaves legacy URLs untouched", async () => {
        mockPrisma.booking.findMany.mockResolvedValue([
            {
                id: "booking-1",
                candidate: {
                    candidateProfile: {
                        resumeUrl:
                            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf",
                    },
                },
            },
            {
                id: "booking-2",
                candidate: {
                    candidateProfile: {
                        resumeUrl: "https://legacy-storage.example.com/resumes/cand-2/resume.pdf",
                    },
                },
            },
        ]);

        const result = await getPendingRequests("pro-1", "PROFESSIONAL");

        expect(createResumeUrlSignerMock).toHaveBeenCalledTimes(1);
        expect(result[0].candidate.candidateProfile?.resumeUrl).toBe(
            "https://project-ref.supabase.co/storage/v1/object/candidate-resumes/resumes/cand-1/resume.pdf?signed=1"
        );
        expect(result[1].candidate.candidateProfile?.resumeUrl).toBe(
            "https://legacy-storage.example.com/resumes/cand-2/resume.pdf"
        );
    });
});
