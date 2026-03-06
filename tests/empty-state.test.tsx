import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EmptyState } from "@/components/ui";

describe("EmptyState", () => {
    it("renders primary and secondary actions in server markup", () => {
        const html = renderToStaticMarkup(
            <EmptyState
                title="Nothing here"
                description="Add data to continue."
                actionLabel="Browse"
                actionHref="/candidate/browse"
                secondaryActionLabel="Settings"
                secondaryActionHref="/candidate/settings"
                layout="inline"
            />
        );

        expect(html).toContain("Nothing here");
        expect(html).toContain("Browse");
        expect(html).toContain("Settings");
        expect(html).toContain('href="/candidate/browse"');
        expect(html).toContain('href="/candidate/settings"');
    });
});
