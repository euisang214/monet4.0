import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CandidateLayout from "@/app/candidate/layout";

describe("CandidateLayout", () => {
    it("renders body content without duplicate section navigation", () => {
        const html = renderToStaticMarkup(
            <CandidateLayout>
                <div>Candidate body</div>
            </CandidateLayout>
        );

        expect(html).toContain("Candidate body");
        expect(html).not.toContain('aria-label="Section navigation"');
    });
});
