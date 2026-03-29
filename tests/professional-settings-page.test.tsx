import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        replace: vi.fn(),
    }),
    useSearchParams: () => ({
        get: () => null,
    }),
}));

import ProfessionalSettingsPage from "@/app/professional/settings/page";

describe("ProfessionalSettingsPage", () => {
    it("renders the loading card inside suspense fallback", () => {
        const html = renderToStaticMarkup(<ProfessionalSettingsPage />);

        expect(html).toContain("Loading professional settings");
    });
});
