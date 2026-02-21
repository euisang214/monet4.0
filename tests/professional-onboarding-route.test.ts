import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const generateOnboardingLinkMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth", () => ({
    auth: authMock,
}));

vi.mock("@/lib/domain/users/onboarding-service", () => ({
    OnboardingService: {
        generateOnboardingLink: generateOnboardingLinkMock,
    },
}));

import { POST } from "@/app/api/professional/onboarding/route";

function makeRequest(body?: unknown) {
    return new Request("http://localhost/api/professional/onboarding", {
        method: "POST",
        headers: { origin: "https://app.example.com", "Content-Type": "application/json" },
        body: typeof body === "undefined" ? undefined : JSON.stringify(body),
    });
}

describe("POST /api/professional/onboarding", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateOnboardingLinkMock.mockResolvedValue({ url: "https://stripe.example.com/link" });
    });

    it("uses onboarding return/refresh URLs when context is onboarding", async () => {
        authMock.mockResolvedValue({
            user: { id: "pro-1", role: "PROFESSIONAL" },
        });

        const response = await POST(makeRequest({ context: "onboarding" }));

        expect(response.status).toBe(200);
        expect(generateOnboardingLinkMock).toHaveBeenCalledWith(
            "pro-1",
            "https://app.example.com/onboarding?success=stripe_connected",
            "https://app.example.com/onboarding?error=stripe_refresh"
        );
    });

    it("defaults to settings return/refresh URLs", async () => {
        authMock.mockResolvedValue({
            user: { id: "pro-1", role: "PROFESSIONAL" },
        });

        const response = await POST(makeRequest());

        expect(response.status).toBe(200);
        expect(generateOnboardingLinkMock).toHaveBeenCalledWith(
            "pro-1",
            "https://app.example.com/professional/settings?success=stripe_connected",
            "https://app.example.com/professional/settings?error=stripe_refresh"
        );
    });

    it("returns unauthorized for non-professional sessions", async () => {
        authMock.mockResolvedValue({
            user: { id: "cand-1", role: "CANDIDATE" },
        });

        const response = await POST(makeRequest({ context: "settings" }));

        expect(response.status).toBe(401);
    });
});
