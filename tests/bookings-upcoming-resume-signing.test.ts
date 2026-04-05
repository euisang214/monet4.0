import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findMany: vi.fn(),
    },
}));

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

import { getPendingRequests } from "@/lib/shared/bookings/upcoming";

describe("upcoming bookings resume links", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns on-demand resume hrefs for professional pending requests", async () => {
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

        expect(result[0].resumeHref).toBe("/api/professional/requests/booking-1/resume");
        expect(result[1].resumeHref).toBe("/api/professional/requests/booking-2/resume");
    });
});
