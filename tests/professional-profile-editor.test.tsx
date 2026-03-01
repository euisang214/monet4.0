import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfessionalProfileEditor } from "@/components/profile/ProfessionalProfileEditor";

describe("ProfessionalProfileEditor", () => {
    it("renders payout gating UI in onboarding mode", () => {
        const html = renderToStaticMarkup(
            <ProfessionalProfileEditor
                mode="onboarding"
                initialData={{
                    timezone: "America/New_York",
                    bio: "Mentor",
                    price: 200,
                    corporateEmail: "pro@example.com",
                    interests: ["Mentorship"],
                    experience: [
                        {
                            company: "Monet",
                            title: "Principal",
                            startDate: "2022-01-01",
                            isCurrent: true,
                        },
                    ],
                    activities: [
                        {
                            company: "Club",
                            title: "Speaker",
                            startDate: "2021-01-01",
                            isCurrent: true,
                        },
                    ],
                    education: [
                        {
                            school: "State U",
                            degree: "MBA",
                            fieldOfStudy: "Business",
                            startDate: "2015-09-01",
                            isCurrent: false,
                        },
                    ],
                }}
                submitLabel="Complete onboarding"
                onSubmit={async () => {}}
                requirePayoutReady
                stripeStatus={{ accountId: null, payoutsEnabled: false }}
                onConnectStripe={async () => {}}
            />
        );

        expect(html).toContain("Stripe payouts");
        expect(html).toContain("Stripe payouts are not enabled yet.");
        expect(html).toContain("Connect Stripe for Payouts");
        expect(html).toContain("Complete onboarding");
        expect(html).toContain('id="professional-corporate-email"');
    });

    it("renders shared profile sections for settings mode", () => {
        const html = renderToStaticMarkup(
            <ProfessionalProfileEditor
                mode="settings"
                initialData={{
                    timezone: "America/New_York",
                    bio: "Mentor",
                    price: 200,
                    corporateEmail: "pro@example.com",
                    interests: ["Mentorship"],
                    experience: [
                        {
                            company: "Monet",
                            title: "Principal",
                            startDate: "2022-01-01",
                            isCurrent: true,
                        },
                    ],
                    activities: [
                        {
                            company: "Club",
                            title: "Speaker",
                            startDate: "2021-01-01",
                            isCurrent: true,
                        },
                    ],
                    education: [
                        {
                            school: "State U",
                            degree: "MBA",
                            fieldOfStudy: "Business",
                            startDate: "2015-09-01",
                            isCurrent: false,
                        },
                    ],
                }}
                submitLabel="Save settings"
                onSubmit={async () => {}}
            />
        );

        expect(html).toContain("Account basics");
        expect(html).toContain("Add experience");
        expect(html).toContain("Add activity");
        expect(html).toContain("Add education");
        expect(html).toContain('id="professional-timezone-settings"');
        expect(html).toContain("<select");
        expect(html).toContain('value="UTC"');
        expect(html).toContain("Save settings");
        expect(html).not.toContain('id="professional-corporate-email"');
    });

    it("disables submit when corporate verification is required but not verified", () => {
        const html = renderToStaticMarkup(
            <ProfessionalProfileEditor
                mode="onboarding"
                initialData={{
                    firstName: "Morgan",
                    lastName: "Lee",
                    timezone: "America/New_York",
                    bio: "Mentor",
                    price: 200,
                    corporateEmail: "pro@example.com",
                    interests: ["Mentorship"],
                    experience: [
                        {
                            company: "Monet",
                            title: "Principal",
                            startDate: "2022-01-01",
                            isCurrent: true,
                        },
                    ],
                    activities: [
                        {
                            company: "Club",
                            title: "Speaker",
                            startDate: "2021-01-01",
                            isCurrent: true,
                        },
                    ],
                    education: [
                        {
                            school: "State U",
                            degree: "MBA",
                            fieldOfStudy: "Business",
                            startDate: "2015-09-01",
                            isCurrent: false,
                        },
                    ],
                }}
                submitLabel="Complete onboarding"
                onSubmit={async () => {}}
                requireCorporateVerification
                isCorporateEmailVerified={false}
            />
        );

        expect(html).toContain("Verify your corporate email to complete onboarding.");
        expect(html).toContain('type="submit" disabled=""');
    });

    it("enables submit when corporate verification is required and verified", () => {
        const html = renderToStaticMarkup(
            <ProfessionalProfileEditor
                mode="onboarding"
                initialData={{
                    firstName: "Morgan",
                    lastName: "Lee",
                    timezone: "America/New_York",
                    bio: "Mentor",
                    price: 200,
                    corporateEmail: "pro@example.com",
                    interests: ["Mentorship"],
                    experience: [
                        {
                            company: "Monet",
                            title: "Principal",
                            startDate: "2022-01-01",
                            isCurrent: true,
                        },
                    ],
                    activities: [
                        {
                            company: "Club",
                            title: "Speaker",
                            startDate: "2021-01-01",
                            isCurrent: true,
                        },
                    ],
                    education: [
                        {
                            school: "State U",
                            degree: "MBA",
                            fieldOfStudy: "Business",
                            startDate: "2015-09-01",
                            isCurrent: false,
                        },
                    ],
                }}
                submitLabel="Complete onboarding"
                onSubmit={async () => {}}
                requireCorporateVerification
                isCorporateEmailVerified
            />
        );

        expect(html).not.toContain("Verify your corporate email to complete onboarding.");
        expect(html).not.toContain('type="submit" disabled=""');
    });
});
