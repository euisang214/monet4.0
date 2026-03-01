import React from "react";
import { Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: routerPushMock,
        refresh: routerRefreshMock,
    }),
}));

vi.mock("next-auth/react", () => ({
    useSession: () => ({
        update: updateMock,
    }),
}));

import { OnboardingForm } from "@/components/auth/OnboardingForm";

const baseProfessionalInitialData = {
    firstName: "Morgan",
    lastName: "Lee",
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
            company: "Association",
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
};

describe("OnboardingForm corporate verification", () => {
    it("renders verification controls and unverified guidance for professional onboarding", () => {
        const html = renderToStaticMarkup(
            <OnboardingForm
                role={Role.PROFESSIONAL}
                initialTimezone="America/New_York"
                initialProfessional={baseProfessionalInitialData}
                initialProfessionalEmailVerified={false}
            />
        );

        expect(html).toContain("Corporate Email Verification");
        expect(html).toContain("Send Code");
        expect(html).toContain("Verify your corporate email to complete onboarding.");
    });

    it("recognizes already verified professional email when onboarding email is unchanged", () => {
        const html = renderToStaticMarkup(
            <OnboardingForm
                role={Role.PROFESSIONAL}
                initialTimezone="America/New_York"
                initialProfessional={{
                    ...baseProfessionalInitialData,
                    verifiedAt: "2026-02-28T12:00:00.000Z",
                }}
                initialProfessionalEmailVerified
            />
        );

        expect(html).toContain("Corporate Email Verification");
        expect(html).toContain("Corporate email is verified.");
        expect(html).not.toContain("Verify your corporate email to complete onboarding.");
    });
});

