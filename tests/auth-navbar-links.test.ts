import { describe, expect, it } from "vitest";
import { resolveNavLinksForSessionUser } from "@/components/layout/auth-navbar-links";

describe("AuthNavbar nav links", () => {
    it("shows only onboarding link for incomplete candidate users", () => {
        const links = resolveNavLinksForSessionUser({
            role: "CANDIDATE",
            onboardingRequired: true,
            onboardingCompleted: false,
        });

        expect(links).toEqual([{ label: "Onboarding", href: "/onboarding" }]);
    });

    it("shows only onboarding link for incomplete professional users", () => {
        const links = resolveNavLinksForSessionUser({
            role: "PROFESSIONAL",
            onboardingRequired: true,
            onboardingCompleted: false,
        });

        expect(links).toEqual([{ label: "Onboarding", href: "/onboarding" }]);
    });

    it("shows full role navigation for completed users", () => {
        const links = resolveNavLinksForSessionUser({
            role: "CANDIDATE",
            onboardingRequired: true,
            onboardingCompleted: true,
        });

        expect(links.map((link) => link.label)).toEqual(["Browse", "Chats", "Availability", "Settings"]);
    });

    it("keeps admin navigation unchanged", () => {
        const links = resolveNavLinksForSessionUser({
            role: "ADMIN",
            onboardingRequired: false,
            onboardingCompleted: false,
        });

        expect(links.map((link) => link.label)).toEqual(["Bookings", "Disputes", "Users", "Feedback", "Payments"]);
    });
});
