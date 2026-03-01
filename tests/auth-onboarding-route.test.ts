import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const authMock = vi.hoisted(() => vi.fn());
const upsertCandidateProfileFromPayloadMock = vi.hoisted(() => vi.fn());
const upsertProfessionalProfileFromPayloadMock = vi.hoisted(() => vi.fn());
const getProfessionalStripeStatusMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
    user: {
        findUnique: vi.fn(),
    },
}));

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("@/lib/core/db", () => ({
    prisma: prismaMock,
}));

vi.mock("@/lib/domain/users/profile-upsert-service", async () => {
    const actual = await vi.importActual<typeof import("@/lib/domain/users/profile-upsert-service")>(
        "@/lib/domain/users/profile-upsert-service"
    );

    return {
        ...actual,
        upsertCandidateProfileFromPayload: upsertCandidateProfileFromPayloadMock,
        upsertProfessionalProfileFromPayload: upsertProfessionalProfileFromPayloadMock,
    };
});

vi.mock("@/lib/domain/users/professional-stripe-status", () => ({
    getProfessionalStripeStatus: getProfessionalStripeStatusMock,
}));

import { POST } from "@/app/api/auth/onboarding/route";

function makeRequest(body: unknown) {
    return new Request("http://localhost/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const validCandidatePayload = {
    firstName: "Casey",
    lastName: "Jordan",
    timezone: "America/New_York",
    interests: ["Interview Prep"],
    experience: [
        {
            company: "Acme Corp",
            title: "Analyst",
            startDate: "2023-01-01",
            endDate: "2024-01-01",
            isCurrent: false,
        },
    ],
    activities: [
        {
            company: "Mentorship Club",
            title: "Mentor",
            startDate: "2022-01-01",
            isCurrent: true,
        },
    ],
    education: [
        {
            school: "State University",
            degree: "BS",
            fieldOfStudy: "Economics",
            startDate: "2018-09-01",
            endDate: "2022-05-01",
            isCurrent: false,
        },
    ],
};

const validProfessionalPayload = {
    firstName: "Morgan",
    lastName: "Lee",
    bio: "Guides candidates through case prep.",
    price: 200,
    corporateEmail: "pro@monet.com",
    timezone: "America/New_York",
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
            startDate: "2021-05-01",
            isCurrent: true,
        },
    ],
    education: [
        {
            school: "University A",
            degree: "BS",
            fieldOfStudy: "Finance",
            startDate: "2012-09-01",
            endDate: "2016-05-01",
            isCurrent: false,
        },
    ],
};

describe("POST /api/auth/onboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.user.findUnique.mockResolvedValue({
            onboardingRequired: true,
            onboardingCompleted: true,
        });
    });

    it("completes candidate onboarding using shared upsert service", async () => {
        authMock.mockResolvedValue({
            user: { id: "candidate_1", role: Role.CANDIDATE },
        });

        upsertCandidateProfileFromPayloadMock.mockResolvedValue({
            success: true,
            resumeUrl: "https://example.com/resume.pdf",
        });

        const response = await POST(makeRequest(validCandidatePayload));

        expect(response.status).toBe(200);
        expect(upsertCandidateProfileFromPayloadMock).toHaveBeenCalledWith(
            "candidate_1",
            expect.objectContaining({ timezone: "America/New_York" }),
            { markOnboardingCompleted: true }
        );
    });

    it("rejects candidate onboarding when no resume is available", async () => {
        authMock.mockResolvedValue({
            user: { id: "candidate_2", role: Role.CANDIDATE },
        });

        upsertCandidateProfileFromPayloadMock.mockResolvedValue({
            success: false,
            error: "resume_required",
        });

        const response = await POST(makeRequest(validCandidatePayload));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("validation_error");
        expect(body.details?.fieldErrors?.resumeUrl?.[0]).toContain("Resume is required");
    });

    it("rejects candidate onboarding payloads with an unsupported timezone", async () => {
        authMock.mockResolvedValue({
            user: { id: "candidate_2", role: Role.CANDIDATE },
        });

        const response = await POST(
            makeRequest({
                ...validCandidatePayload,
                timezone: "Mars/Olympus",
            })
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("validation_error");
        expect(upsertCandidateProfileFromPayloadMock).not.toHaveBeenCalled();
    });

    it("rejects professional onboarding when Stripe payouts are not ready", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_1", role: Role.PROFESSIONAL },
        });
        prismaMock.user.findUnique.mockResolvedValueOnce({
            onboardingCompleted: false,
        });

        getProfessionalStripeStatusMock.mockResolvedValue({
            accountId: "acct_123",
            payoutsEnabled: false,
            chargesEnabled: true,
            detailsSubmitted: true,
            isPayoutReady: false,
        });

        const response = await POST(makeRequest(validProfessionalPayload));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("stripe_payout_not_ready");
        expect(upsertProfessionalProfileFromPayloadMock).not.toHaveBeenCalled();
    });

    it("rejects professional onboarding payloads with an unsupported timezone", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_1", role: Role.PROFESSIONAL },
        });

        const response = await POST(
            makeRequest({
                ...validProfessionalPayload,
                timezone: "Mars/Olympus",
            })
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("validation_error");
        expect(upsertProfessionalProfileFromPayloadMock).not.toHaveBeenCalled();
        expect(getProfessionalStripeStatusMock).not.toHaveBeenCalled();
    });

    it("allows professional onboarding when payouts are enabled even if charges are disabled", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_2", role: Role.PROFESSIONAL },
        });
        prismaMock.user.findUnique.mockResolvedValueOnce({
            onboardingCompleted: false,
            corporateEmailVerified: true,
            professionalProfile: {
                corporateEmail: "pro@monet.com",
                verifiedAt: new Date("2026-02-28T12:00:00Z"),
            },
        });

        getProfessionalStripeStatusMock.mockResolvedValue({
            accountId: "acct_123",
            payoutsEnabled: true,
            chargesEnabled: false,
            detailsSubmitted: false,
            isPayoutReady: true,
        });

        upsertProfessionalProfileFromPayloadMock.mockResolvedValue(undefined);

        const response = await POST(makeRequest(validProfessionalPayload));

        expect(response.status).toBe(200);
        expect(upsertProfessionalProfileFromPayloadMock).toHaveBeenCalledWith(
            "professional_2",
            expect.objectContaining({ bio: "Guides candidates through case prep." }),
            { markOnboardingCompleted: true }
        );
    });

    it("rejects professional onboarding when corporate email is not verified", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_5", role: Role.PROFESSIONAL },
        });
        prismaMock.user.findUnique.mockResolvedValueOnce({
            onboardingCompleted: false,
            corporateEmailVerified: false,
            professionalProfile: {
                corporateEmail: "pro@monet.com",
                verifiedAt: null,
            },
        });

        getProfessionalStripeStatusMock.mockResolvedValue({
            accountId: "acct_123",
            payoutsEnabled: true,
            chargesEnabled: true,
            detailsSubmitted: true,
            isPayoutReady: true,
        });

        const response = await POST(makeRequest(validProfessionalPayload));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("corporate_email_not_verified");
        expect(upsertProfessionalProfileFromPayloadMock).not.toHaveBeenCalled();
    });

    it("does not enforce Stripe payout gate for already completed professionals", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_4", role: Role.PROFESSIONAL },
        });
        prismaMock.user.findUnique.mockResolvedValueOnce({
            onboardingCompleted: true,
        });

        upsertProfessionalProfileFromPayloadMock.mockResolvedValue(undefined);

        const response = await POST(makeRequest(validProfessionalPayload));

        expect(response.status).toBe(200);
        expect(getProfessionalStripeStatusMock).not.toHaveBeenCalled();
        expect(upsertProfessionalProfileFromPayloadMock).toHaveBeenCalledWith(
            "professional_4",
            expect.objectContaining({ bio: "Guides candidates through case prep." }),
            { markOnboardingCompleted: true }
        );
    });

    it("rejects professional onboarding payloads that include legacy employer/title fields", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_3", role: Role.PROFESSIONAL },
        });

        const response = await POST(
            makeRequest({
                ...validProfessionalPayload,
                employer: "Legacy Corp",
                title: "Legacy Title",
            })
        );

        expect(response.status).toBe(400);
        expect(upsertProfessionalProfileFromPayloadMock).not.toHaveBeenCalled();
        expect(getProfessionalStripeStatusMock).not.toHaveBeenCalled();
    });
});
