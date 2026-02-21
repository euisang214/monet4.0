import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertCandidateProfileMock = vi.hoisted(() => vi.fn());
const upsertProfessionalProfileMock = vi.hoisted(() => vi.fn());
const signResumeUrlMock = vi.hoisted(() => vi.fn());

const prismaMock = vi.hoisted(() => ({
    candidateProfile: {
        findUnique: vi.fn(),
    },
    professionalProfile: {
        findUnique: vi.fn(),
    },
    user: {
        update: vi.fn(),
    },
}));

vi.mock("@/lib/core/db", () => ({
    prisma: prismaMock,
}));

vi.mock("@/lib/domain/users/service", () => ({
    upsertCandidateProfile: upsertCandidateProfileMock,
    upsertProfessionalProfile: upsertProfessionalProfileMock,
}));

vi.mock("@/lib/integrations/resume-storage", () => ({
    createResumeUrlSigner: () => signResumeUrlMock,
}));

import {
    getCandidateProfileForSettings,
    upsertCandidateProfileFromPayload,
    upsertProfessionalProfileFromPayload,
} from "@/lib/domain/users/profile-upsert-service";

describe("profile-upsert-service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.user.update.mockResolvedValue({});
    });

    it("returns resume_required when candidate has no payload or existing resume", async () => {
        prismaMock.candidateProfile.findUnique.mockResolvedValue({ resumeUrl: null });

        const result = await upsertCandidateProfileFromPayload("cand-1", {
            timezone: "America/New_York",
            interests: ["Interview Prep"],
            experience: [
                {
                    company: "Acme",
                    title: "Analyst",
                    startDate: new Date("2023-01-01"),
                    isCurrent: true,
                    positionHistory: [],
                },
            ],
            activities: [
                {
                    company: "Club",
                    title: "Mentor",
                    startDate: new Date("2022-01-01"),
                    isCurrent: true,
                    positionHistory: [],
                },
            ],
            education: [
                {
                    school: "State U",
                    degree: "BS",
                    fieldOfStudy: "Economics",
                    startDate: new Date("2018-01-01"),
                    isCurrent: false,
                    endDate: new Date("2022-01-01"),
                    activities: [],
                },
            ],
        });

        expect(result).toEqual({ success: false, error: "resume_required" });
        expect(upsertCandidateProfileMock).not.toHaveBeenCalled();
    });

    it("upserts candidate profile and updates user timezone/onboarding flag", async () => {
        prismaMock.candidateProfile.findUnique.mockResolvedValue({
            resumeUrl: "https://example.com/existing.pdf",
        });

        upsertCandidateProfileMock.mockResolvedValue({ userId: "cand-1" });

        const result = await upsertCandidateProfileFromPayload(
            "cand-1",
            {
                timezone: "America/New_York",
                interests: ["Interview Prep", "Interview Prep"],
                experience: [
                    {
                        company: "Acme",
                        title: "Analyst",
                        startDate: new Date("2023-01-01"),
                        isCurrent: true,
                        positionHistory: [],
                    },
                ],
                activities: [
                    {
                        company: "Club",
                        title: "Mentor",
                        startDate: new Date("2022-01-01"),
                        isCurrent: true,
                        positionHistory: [],
                    },
                ],
                education: [
                    {
                        school: "State U",
                        degree: "BS",
                        fieldOfStudy: "Economics",
                        startDate: new Date("2018-01-01"),
                        isCurrent: false,
                        endDate: new Date("2022-01-01"),
                        activities: ["Leadership"],
                    },
                ],
            },
            { markOnboardingCompleted: true }
        );

        expect(result).toEqual({
            success: true,
            resumeUrl: "https://example.com/existing.pdf",
        });
        expect(upsertCandidateProfileMock).toHaveBeenCalledWith(
            "cand-1",
            expect.objectContaining({
                resumeUrl: "https://example.com/existing.pdf",
                interests: ["Interview Prep"],
            })
        );
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: "cand-1" },
            data: {
                timezone: "America/New_York",
                onboardingCompleted: true,
            },
        });
    });

    it("upserts professional profile with price cents and existing availability prefs", async () => {
        prismaMock.professionalProfile.findUnique.mockResolvedValue({
            availabilityPrefs: { windows: ["weekday"] },
        });

        upsertProfessionalProfileMock.mockResolvedValue({ userId: "pro-1" });

        await upsertProfessionalProfileFromPayload("pro-1", {
            bio: "Mentor",
            price: 120,
            corporateEmail: "pro@example.com",
            timezone: "America/New_York",
            interests: ["Mentorship"],
            experience: [
                {
                    company: "Monet",
                    title: "Principal",
                    startDate: new Date("2022-01-01"),
                    isCurrent: true,
                    positionHistory: [],
                },
            ],
            activities: [
                {
                    company: "Club",
                    title: "Speaker",
                    startDate: new Date("2021-01-01"),
                    isCurrent: true,
                    positionHistory: [],
                },
            ],
            education: [
                {
                    school: "State U",
                    degree: "MBA",
                    fieldOfStudy: "Business",
                    startDate: new Date("2015-01-01"),
                    isCurrent: false,
                    endDate: new Date("2017-01-01"),
                    activities: [],
                },
            ],
        });

        expect(upsertProfessionalProfileMock).toHaveBeenCalledWith(
            "pro-1",
            expect.objectContaining({
                priceCents: 12000,
                availabilityPrefs: { windows: ["weekday"] },
                corporateEmail: "pro@example.com",
            })
        );
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: "pro-1" },
            data: {
                timezone: "America/New_York",
            },
        });
    });

    it("returns signed resume URL in candidate settings profile", async () => {
        prismaMock.candidateProfile.findUnique.mockResolvedValue({
            userId: "cand-1",
            resumeUrl: "https://storage.example.com/resume.pdf",
            interests: ["Interview Prep"],
            experience: [],
            activities: [],
            education: [],
        });
        signResumeUrlMock.mockResolvedValue("https://signed.example.com/resume.pdf");

        const result = await getCandidateProfileForSettings("cand-1");

        expect(result).toEqual(
            expect.objectContaining({
                resumeUrl: "https://storage.example.com/resume.pdf",
                resumeViewUrl: "https://signed.example.com/resume.pdf",
            })
        );
    });
});
