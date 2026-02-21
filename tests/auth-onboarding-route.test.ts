import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const authMock = vi.hoisted(() => vi.fn());
const txMocks = vi.hoisted(() => ({
    candidateProfile: {
        upsert: vi.fn(),
    },
    professionalProfile: {
        upsert: vi.fn(),
    },
    experience: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
    },
    education: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
    },
    user: {
        update: vi.fn(),
    },
}));

const prismaMock = vi.hoisted(() => ({
    candidateProfile: {
        findUnique: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("@/lib/core/db", () => ({
    prisma: prismaMock,
}));

import { POST } from "@/app/api/auth/onboarding/route";

function makeRequest(body: unknown) {
    return new Request("http://localhost/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /api/auth/onboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMocks) => Promise<unknown>) =>
            callback(txMocks)
        );
        prismaMock.user.findUnique.mockResolvedValue({
            onboardingRequired: true,
            onboardingCompleted: true,
        });
    });

    it("allows candidates to complete onboarding using an existing resume on file", async () => {
        authMock.mockResolvedValue({
            user: { id: "candidate_1", role: Role.CANDIDATE },
        });
        prismaMock.candidateProfile.findUnique.mockResolvedValue({
            resumeUrl: "https://example.com/existing-resume.pdf",
        });

        const response = await POST(
            makeRequest({
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
            })
        );

        expect(response.status).toBe(200);
        expect(prismaMock.candidateProfile.findUnique).toHaveBeenCalledWith({
            where: { userId: "candidate_1" },
            select: { resumeUrl: true },
        });
        expect(txMocks.candidateProfile.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    resumeUrl: "https://example.com/existing-resume.pdf",
                }),
            })
        );
        expect(txMocks.experience.createMany).toHaveBeenCalledTimes(2);
        expect(txMocks.experience.createMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        candidateId: "candidate_1",
                        type: "EXPERIENCE",
                    }),
                ],
            })
        );
        expect(txMocks.experience.createMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                data: [
                    expect.objectContaining({
                        candidateActivityId: "candidate_1",
                        type: "ACTIVITY",
                    }),
                ],
            })
        );
        expect(txMocks.education.createMany).toHaveBeenCalledTimes(1);
    });

    it("rejects candidate onboarding when no resume exists in payload or profile", async () => {
        authMock.mockResolvedValue({
            user: { id: "candidate_2", role: Role.CANDIDATE },
        });
        prismaMock.candidateProfile.findUnique.mockResolvedValue({
            resumeUrl: null,
        });

        const response = await POST(
            makeRequest({
                timezone: "America/New_York",
                interests: ["Interview Prep"],
                experience: [
                    {
                        company: "Acme Corp",
                        title: "Analyst",
                        startDate: "2023-01-01",
                        isCurrent: true,
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
                        isCurrent: true,
                    },
                ],
            })
        );

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(body.error).toBe("validation_error");
        expect(body.details?.fieldErrors?.resumeUrl?.[0]).toContain("Resume is required");
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("requires at least one experience, activity, and education entry", async () => {
        authMock.mockResolvedValue({
            user: { id: "candidate_3", role: Role.CANDIDATE },
        });
        prismaMock.candidateProfile.findUnique.mockResolvedValue({
            resumeUrl: "https://example.com/resume.pdf",
        });

        const response = await POST(
            makeRequest({
                timezone: "America/New_York",
                resumeUrl: "https://example.com/resume.pdf",
                interests: ["Interview Prep"],
                experience: [],
                activities: [],
                education: [],
            })
        );

        expect(response.status).toBe(400);
        expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("persists multiple professional experiences, activities, and education entries", async () => {
        authMock.mockResolvedValue({
            user: { id: "professional_1", role: Role.PROFESSIONAL },
        });

        const response = await POST(
            makeRequest({
                employer: "Monet",
                title: "Principal",
                bio: "Guides candidates through case prep.",
                price: 200,
                corporateEmail: "pro@monet.com",
                timezone: "America/New_York",
                interests: ["Mentorship", "Interview Coaching"],
                experience: [
                    {
                        company: "Monet",
                        title: "Principal",
                        startDate: "2022-01-01",
                        isCurrent: true,
                    },
                    {
                        company: "Prev Co",
                        title: "Manager",
                        startDate: "2020-01-01",
                        endDate: "2021-12-31",
                        isCurrent: false,
                    },
                ],
                activities: [
                    {
                        company: "Association",
                        title: "Speaker",
                        startDate: "2021-05-01",
                        isCurrent: true,
                    },
                    {
                        company: "Volunteer Group",
                        title: "Coach",
                        startDate: "2020-05-01",
                        endDate: "2021-04-01",
                        isCurrent: false,
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
                    {
                        school: "University B",
                        degree: "MBA",
                        fieldOfStudy: "Management",
                        startDate: "2018-09-01",
                        endDate: "2020-05-01",
                        isCurrent: false,
                    },
                ],
            })
        );

        expect(response.status).toBe(200);
        expect(txMocks.professionalProfile.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({
                    interests: ["Mentorship", "Interview Coaching"],
                }),
            })
        );
        expect(txMocks.experience.createMany).toHaveBeenCalledTimes(2);
        expect(txMocks.experience.createMany).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                data: expect.arrayContaining([expect.objectContaining({ professionalId: "professional_1" })]),
            })
        );
        expect(txMocks.experience.createMany).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                data: expect.arrayContaining([expect.objectContaining({ professionalActivityId: "professional_1" })]),
            })
        );
        expect(txMocks.education.createMany).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.arrayContaining([expect.objectContaining({ professionalId: "professional_1" })]),
            })
        );
    });
});
