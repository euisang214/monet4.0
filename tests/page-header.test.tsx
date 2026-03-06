import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "@/components/ui";

describe("PageHeader", () => {
    it("renders eyebrow, title, description, and meta content", () => {
        const html = renderToStaticMarkup(
            <PageHeader
                eyebrow="Dashboard"
                title="Overview"
                description="Track activity across the app."
                meta="12 open items"
            />
        );

        expect(html).toContain("Dashboard");
        expect(html).toContain("Overview");
        expect(html).toContain("Track activity across the app.");
        expect(html).toContain("12 open items");
    });
});
