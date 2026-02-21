import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
    auth: authMock,
}));

import { GET } from "@/app/api/auth/callback-redirect/route";

describe("GET /api/auth/callback-redirect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects onboarding-required users to /onboarding", async () => {
        authMock.mockResolvedValue({
            user: {
                id: "user_1",
                role: Role.CANDIDATE,
                onboardingRequired: true,
                onboardingCompleted: false,
            },
        });

        const response = await GET();
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toContain("/onboarding");
    });

    it("redirects fully onboarded candidates to candidate browse", async () => {
        authMock.mockResolvedValue({
            user: {
                id: "user_1",
                role: Role.CANDIDATE,
                onboardingRequired: true,
                onboardingCompleted: true,
            },
        });

        const response = await GET();
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toContain("/candidate/browse");
    });
});
