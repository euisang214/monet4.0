import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const authMock = vi.hoisted(() => vi.fn());
const searchProfessionalsMock = vi.hoisted(() => vi.fn());
const routerPushMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: routerPushMock,
    }),
}));

vi.mock("@/lib/role/candidate/browse", () => ({
    CandidateBrowse: {
        searchProfessionals: searchProfessionalsMock,
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
                    employer: "Monet",
                    priceCents: 25000,
                    bio: "Helps candidates sharpen interviews.",
                },
            ],
            nextCursor: "cursor-2",
        });
    });

    it("renders the refreshed browse page header and listing card", async () => {
        const view = await BrowsePage({ searchParams: {} });
        const html = renderToStaticMarkup(view);

        expect(html).toContain("Find your next career mentor");
        expect(html).toContain("Curated mentor");
        expect(html).toContain("View Profile");
        expect(html).toContain("Older");
    });
});
