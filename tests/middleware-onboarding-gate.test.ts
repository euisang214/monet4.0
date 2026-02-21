import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next-auth/jwt", () => ({
    getToken: getTokenMock,
}));

import { middleware } from "@/middleware";

describe("middleware onboarding gate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("redirects incomplete candidate users to onboarding on non-onboarding routes", async () => {
        getTokenMock.mockResolvedValue({
            role: "CANDIDATE",
            onboardingRequired: true,
            onboardingCompleted: false,
        });

        const response = await middleware(new NextRequest("http://localhost/login"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toContain("/onboarding");
    });

    it("allows incomplete users to stay on onboarding route", async () => {
        getTokenMock.mockResolvedValue({
            role: "PROFESSIONAL",
            onboardingRequired: true,
            onboardingCompleted: false,
        });

        const response = await middleware(new NextRequest("http://localhost/onboarding"));

        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
    });

    it("keeps unauthenticated protection for role routes", async () => {
        getTokenMock.mockResolvedValue(null);

        const response = await middleware(new NextRequest("http://localhost/candidate/browse"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toContain("/api/auth/signin");
    });

    it("redirects mismatched role access to home", async () => {
        getTokenMock.mockResolvedValue({
            role: "CANDIDATE",
            onboardingRequired: true,
            onboardingCompleted: true,
        });

        const response = await middleware(new NextRequest("http://localhost/professional/dashboard"));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost/");
    });
});
