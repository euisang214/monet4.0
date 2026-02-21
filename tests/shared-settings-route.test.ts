import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const authMock = vi.hoisted(() => vi.fn());
const profileServiceMock = vi.hoisted(() => ({
    getProfileByUserId: vi.fn(),
}));
const upsertCandidateProfileFromPayloadMock = vi.hoisted(() => vi.fn());
const upsertProfessionalProfileFromPayloadMock = vi.hoisted(() => vi.fn());
const getCandidateProfileForSettingsMock = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/domain/users/profile-service", async () => {
    const actual = await vi.importActual<typeof import("@/lib/domain/users/profile-service")>(
        "@/lib/domain/users/profile-service"
    );

    return {
        ...actual,
        ProfileService: profileServiceMock,
    };
});

vi.mock("@/lib/domain/users/profile-upsert-service", async () => {
    const actual = await vi.importActual<typeof import("@/lib/domain/users/profile-upsert-service")>(
        "@/lib/domain/users/profile-upsert-service"
    );

    return {
        ...actual,
        upsertCandidateProfileFromPayload: upsertCandidateProfileFromPayloadMock,
        upsertProfessionalProfileFromPayload: upsertProfessionalProfileFromPayloadMock,
        getCandidateProfileForSettings: getCandidateProfileForSettingsMock,
    };
});

import { GET, PUT } from "@/app/api/shared/settings/route";

function makeRequest(body: unknown) {
    return new Request("http://localhost/api/shared/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const validProfessionalPayload = {
    bio: "Experienced mentor",
    price: 150,
    corporateEmail: "pro@example.com",
    timezone: "America/New_York",
    interests: ["Mentorship"],
    experience: [
        {
            company: "Test Corp",
            title: "Principal",
            startDate: "2022-01-01",
            isCurrent: true,
        },
    ],
    activities: [
        {
            company: "Nonprofit",
            title: "Advisor",
            startDate: "2023-01-01",
            isCurrent: true,
        },
    ],
    education: [
        {
            school: "State U",
            degree: "MBA",
            fieldOfStudy: "Business",
            startDate: "2010-01-01",
            endDate: "2012-01-01",
            isCurrent: false,
            activities: [],
        },
    ],
};

const validCandidatePayload = {
    timezone: "America/New_York",
    resumeUrl: "https://example.com/resume.pdf",
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
            isCurrent: false,
            activities: [],
        },
    ],
};

describe("shared settings route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.user.findUnique.mockResolvedValue({ timezone: "America/New_York" });
    });

    it("accepts full professional timeline updates", async () => {
        authMock.mockResolvedValue({
            user: { id: "pro-1", role: Role.PROFESSIONAL },
        });

        upsertProfessionalProfileFromPayloadMock.mockResolvedValue(undefined);

        const response = await PUT(makeRequest(validProfessionalPayload));

        expect(response.status).toBe(200);
        expect(upsertProfessionalProfileFromPayloadMock).toHaveBeenCalledWith(
            "pro-1",
            expect.objectContaining({
                bio: "Experienced mentor",
                corporateEmail: "pro@example.com",
            })
        );
    });

    it("rejects professional updates with invalid current-role state", async () => {
        authMock.mockResolvedValue({
            user: { id: "pro-1", role: Role.PROFESSIONAL },
        });

        const response = await PUT(
            makeRequest({
                ...validProfessionalPayload,
                experience: [
                    {
                        company: "Test Corp",
                        title: "Principal",
                        startDate: "2022-01-01",
                        isCurrent: true,
                    },
                    {
                        company: "Old Corp",
                        title: "Manager",
                        startDate: "2020-01-01",
                        isCurrent: true,
                    },
                ],
            })
        );

        expect(response.status).toBe(400);
        expect(upsertProfessionalProfileFromPayloadMock).not.toHaveBeenCalled();
    });

    it("returns full candidate profile payload including resume view URL", async () => {
        authMock.mockResolvedValue({
            user: { id: "cand-1", role: Role.CANDIDATE },
        });

        getCandidateProfileForSettingsMock.mockResolvedValue({
            userId: "cand-1",
            resumeUrl: "https://storage.example.com/resume.pdf",
            resumeViewUrl: "https://signed.example.com/resume.pdf",
            interests: ["Interview Prep"],
            experience: [],
            activities: [],
            education: [],
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.resumeUrl).toBe("https://storage.example.com/resume.pdf");
        expect(body.data.resumeViewUrl).toBe("https://signed.example.com/resume.pdf");
        expect(body.data.timezone).toBe("America/New_York");
    });

    it("returns derived employer/title in professional GET payload", async () => {
        authMock.mockResolvedValue({
            user: { id: "pro-1", role: Role.PROFESSIONAL },
        });

        profileServiceMock.getProfileByUserId.mockResolvedValue({
            userId: "pro-1",
            bio: "Experienced mentor",
            price: 150,
            employer: "Test Corp",
            title: "Principal",
        });

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.employer).toBe("Test Corp");
        expect(body.data.title).toBe("Principal");
        expect(body.data.timezone).toBe("America/New_York");
    });

    it("rejects candidate updates without resume fallback", async () => {
        authMock.mockResolvedValue({
            user: { id: "cand-1", role: Role.CANDIDATE },
        });

        upsertCandidateProfileFromPayloadMock.mockResolvedValue({
            success: false,
            error: "resume_required",
        });

        const response = await PUT(makeRequest(validCandidatePayload));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("validation_error");
        expect(body.details?.fieldErrors?.resumeUrl?.[0]).toContain("Resume is required");
    });
});
