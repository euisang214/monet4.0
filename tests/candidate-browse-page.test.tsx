import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.hoisted(() => vi.fn());
const searchProfessionalsMock = vi.hoisted(() => vi.fn());
const getProfessionalFilterOptionsMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: routerPushMock,
        replace: vi.fn(),
    }),
    usePathname: () => "/candidate/browse",
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/role/candidate/browse", () => ({
    CandidateBrowse: {
        searchProfessionals: searchProfessionalsMock,
        getProfessionalFilterOptions: getProfessionalFilterOptionsMock,
    },
}));

import BrowsePage from "@/app/candidate/browse/page";

describe("Candidate browse page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authMock.mockResolvedValue({ user: { id: "candidate-1" } });
        searchProfessionalsMock.mockResolvedValue({
            items: [
                {
                    userId: "pro-1",
                    title: "Product Lead",
                    employer: "Kafei",
                    industry: "consulting",
                    seniority: "principal",
                    priceCents: 25000,
                    bio: "Helps candidates sharpen interviews.",
                },
            ],
            nextCursor: "cursor-2",
        });
        getProfessionalFilterOptionsMock.mockResolvedValue({
            industries: [{ value: "consulting", label: "Consulting" }],
            companies: [{ value: "Kafei", label: "Kafei" }],
            seniorities: [{ value: "principal", label: "Principal" }],
        });
    });

    it("renders the refreshed browse page header and listing card", async () => {
        const view = await BrowsePage({ searchParams: Promise.resolve({}) });
        const html = renderToStaticMarkup(view);

        expect(html).toContain("Find your next career mentor");
        expect(html).toContain("Filter professionals");
        expect(html).toContain("Curated mentor");
        expect(html).toContain("View Profile");
        expect(html).toContain("Older");
    });

    it("passes active filters through to the page query and pagination links", async () => {
        const view = await BrowsePage({
            searchParams: Promise.resolve({
                industry: "consulting",
                company: "Kafei",
                seniority: "principal",
                cursor: "cursor-1",
            }),
        });
        const html = renderToStaticMarkup(view);

        expect(searchProfessionalsMock).toHaveBeenCalledWith({
            cursor: "cursor-1",
            industry: "consulting",
            company: "Kafei",
            seniority: "principal",
        });
        expect(html).toContain("industry=consulting");
        expect(html).toContain("company=Kafei");
        expect(html).toContain("seniority=principal");
    });
});
