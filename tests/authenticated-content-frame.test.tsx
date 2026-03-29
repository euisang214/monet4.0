import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthenticatedContentFrame } from "@/components/layout/AuthenticatedContentFrame";

describe("AuthenticatedContentFrame", () => {
    it("renders body content without section navigation", () => {
        const html = renderToStaticMarkup(
            <AuthenticatedContentFrame>
                <div>Body content</div>
            </AuthenticatedContentFrame>
        );

        expect(html).toContain("Body content");
        expect(html).not.toContain('aria-label="Section navigation"');
    });
});
