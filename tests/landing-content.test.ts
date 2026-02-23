import { describe, expect, it } from "vitest";
import {
    buildAudienceUrl,
    DEFAULT_AUDIENCE,
    LANDING_CONTENT,
    parseAudience,
    resolveAudience,
} from "@/components/landing/landing-content";

describe("parseAudience", () => {
    it("parses candidate and professional values", () => {
        expect(parseAudience("candidate")).toBe("candidate");
        expect(parseAudience("professional")).toBe("professional");
    });

    it("returns null for invalid values", () => {
        expect(parseAudience(null)).toBeNull();
        expect(parseAudience("")).toBeNull();
        expect(parseAudience("admin")).toBeNull();
    });
});

describe("resolveAudience", () => {
    it("prefers search param over stored value", () => {
        expect(resolveAudience("professional", "candidate")).toBe("professional");
    });

    it("uses stored value when search param is missing", () => {
        expect(resolveAudience(null, "professional")).toBe("professional");
    });

    it("falls back to default when both values are invalid", () => {
        expect(resolveAudience("invalid", "unknown")).toBe(DEFAULT_AUDIENCE);
    });
});

describe("buildAudienceUrl", () => {
    it("preserves existing query params and sets audience", () => {
        const url = buildAudienceUrl("/", new URLSearchParams("ref=nav&source=homepage"), "professional");
        expect(url).toBe("/?ref=nav&source=homepage&audience=professional");
    });

    it("replaces existing audience param and keeps hash", () => {
        const url = buildAudienceUrl("/", new URLSearchParams("audience=candidate&ref=nav"), "professional", "#faq");
        expect(url).toBe("/?audience=professional&ref=nav#faq");
    });
});

describe("LANDING_CONTENT contract", () => {
    it("keeps expected arrays and CTA behavior for each audience", () => {
        for (const [audience, content] of Object.entries(LANDING_CONTENT)) {
            expect(content.stats).toHaveLength(3);
            expect(content.steps).toHaveLength(3);
            expect(content.faq.length).toBeGreaterThanOrEqual(4);

            if (audience === "candidate") {
                expect(content.hero.primaryCta.label).toBe("Browse Professionals");
                expect(content.hero.primaryCta.href).toBe("/signup?role=candidate");
            } else {
                expect(content.hero.primaryCta.label).toBe("Become a Professional");
                expect(content.hero.primaryCta.href).toBe("/signup?role=professional");
            }
        }
    });
});
