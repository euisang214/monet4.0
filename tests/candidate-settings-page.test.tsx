import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CandidateSettingsPage from "@/app/candidate/settings/page";

describe("CandidateSettingsPage", () => {
    it("renders the loading card before client data resolves", () => {
        const html = renderToStaticMarkup(<CandidateSettingsPage />);

        expect(html).toContain("Loading candidate settings");
    });
});
