import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionTabs } from "@/components/ui";

describe("SectionTabs", () => {
    it("renders tabs for both pill and underline appearances", () => {
        const html = renderToStaticMarkup(
            <>
                <SectionTabs
                    items={[
                        { value: "overview", label: "Overview", href: "/dashboard", count: 4 },
                        { value: "history", label: "History", href: "/dashboard?view=history" },
                    ]}
                    currentValue="overview"
                />
                <SectionTabs
                    items={[
                        { value: "overview", label: "Overview", href: "/dashboard" },
                        { value: "history", label: "History", href: "/dashboard?view=history" },
                    ]}
                    currentValue="history"
                    appearance="underline"
                />
            </>
        );

        expect(html).toContain("Overview");
        expect(html).toContain("History");
        expect(html).toContain("4");
    });
});
