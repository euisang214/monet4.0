import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPageContent } from "@/components/landing/LandingPageClient";

describe("LandingPageContent", () => {
    it("renders candidate hero and candidate primary CTA", () => {
        const html = renderToStaticMarkup(
            <LandingPageContent audience="candidate" onAudienceChange={() => {}} />
        );

        expect(html).toContain("Career Advice That Actually Moves the Needle");
        expect(html).toContain("Browse Professionals");
        expect(html).toContain('href="/signup?role=candidate"');
    });

    it("renders professional hero and professional primary CTA", () => {
        const html = renderToStaticMarkup(
            <LandingPageContent audience="professional" onAudienceChange={() => {}} />
        );

        expect(html).toContain("Turn Your Experience Into Impact and Income");
        expect(html).toContain("Become a Professional");
        expect(html).toContain('href="/signup?role=professional"');
    });

    it("always renders shared About section", () => {
        const html = renderToStaticMarkup(
            <LandingPageContent audience="professional" onAudienceChange={() => {}} />
        );

        expect(html).toContain('id="about"');
        expect(html).toContain(">About<");
    });
});
