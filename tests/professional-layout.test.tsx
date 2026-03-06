import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProfessionalLayout from "@/app/professional/layout";

describe("ProfessionalLayout", () => {
    it("renders body content without duplicate section navigation", () => {
        const html = renderToStaticMarkup(
            <ProfessionalLayout>
                <div>Professional body</div>
            </ProfessionalLayout>
        );

        expect(html).toContain("Professional body");
        expect(html).not.toContain('aria-label="Section navigation"');
    });
});
