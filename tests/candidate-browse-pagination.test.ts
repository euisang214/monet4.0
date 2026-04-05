import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
    listingCardView: {
        findMany: vi.fn(),
    },
}));

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

import { CandidateBrowse } from "@/lib/role/candidate/browse";

describe("CandidateBrowse.searchProfessionals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns paginated listings with next cursor", async () => {
        mockPrisma.listingCardView.findMany.mockResolvedValue([
            { userId: "u1", title: "Title 1", employer: "Org 1", industry: "consulting", seniority: "principal", priceCents: 10000, bio: "Bio 1" },
            { userId: "u2", title: "Title 2", employer: "Org 2", industry: "finance", seniority: "manager", priceCents: 11000, bio: "Bio 2" },
            { userId: "u3", title: "Title 3", employer: "Org 3", industry: "law", seniority: "partner", priceCents: 12000, bio: "Bio 3" },
        ]);

        const page = await CandidateBrowse.searchProfessionals({ take: 2 });

        expect(page.items).toHaveLength(2);
        expect(page.nextCursor).toBe("u2");
        expect(mockPrisma.listingCardView.findMany).toHaveBeenCalledWith({
            where: {},
            orderBy: { userId: "asc" },
            take: 3,
        });
    });

    it("passes cursor and skip for next page requests", async () => {
        mockPrisma.listingCardView.findMany.mockResolvedValue([]);

        await CandidateBrowse.searchProfessionals({ cursor: "u5", take: 24 });

        expect(mockPrisma.listingCardView.findMany).toHaveBeenCalledWith({
            where: {},
            orderBy: { userId: "asc" },
            take: 25,
            cursor: { userId: "u5" },
            skip: 1,
        });
    });

    it("applies exact-match filters to the listing query", async () => {
        mockPrisma.listingCardView.findMany.mockResolvedValue([]);

        await CandidateBrowse.searchProfessionals({
            industry: "consulting",
            company: "McKinsey & Company",
            seniority: "senior_consultant",
        });

        expect(mockPrisma.listingCardView.findMany).toHaveBeenCalledWith({
            where: {
                industry: "consulting",
                employer: "McKinsey & Company",
                seniority: "senior_consultant",
            },
            orderBy: { userId: "asc" },
            take: 25,
        });
    });

    it("returns alphabetized filter options from visible listings", async () => {
        mockPrisma.listingCardView.findMany
            .mockResolvedValueOnce([{ industry: "law" }, { industry: "consulting" }])
            .mockResolvedValueOnce([{ employer: "Zeta LLP" }, { employer: "Alpha Advisors" }])
            .mockResolvedValueOnce([{ seniority: "partner" }, { seniority: "director" }]);

        const result = await CandidateBrowse.getProfessionalFilterOptions();

        expect(result).toEqual({
            industries: [
                { value: "consulting", label: "Consulting" },
                { value: "law", label: "Law" },
            ],
            companies: [
                { value: "Alpha Advisors", label: "Alpha Advisors" },
                { value: "Zeta LLP", label: "Zeta LLP" },
            ],
            seniorities: [
                { value: "director", label: "Director" },
                { value: "partner", label: "Partner" },
            ],
        });
    });
});
