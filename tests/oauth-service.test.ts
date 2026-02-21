import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";

const mockPrisma = vi.hoisted(() => ({
    oAuthAccount: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
        deleteMany: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
}));

const createOAuthUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/core/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/domain/auth/services", () => ({
    AuthService: {
        createOAuthUser: createOAuthUserMock,
    },
}));

import {
    OAuthDisconnectLastMethodError,
    OAuthProviderNotConnectedError,
    OAuthRoleRequiredError,
    OAuthService,
} from "@/lib/domain/auth/oauth-service";

describe("OAuthService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("links existing user by provider account", async () => {
        const existingUser = { id: "user_1", email: "test@example.com", role: Role.CANDIDATE };
        mockPrisma.oAuthAccount.findUnique.mockResolvedValue({ user: existingUser });

        const result = await OAuthService.resolveUserForOAuthSignIn({
            provider: "google",
            providerAccountId: "provider-account-1",
            email: "ignored@example.com",
            roleHint: Role.CANDIDATE,
        });

        expect(result).toEqual({ user: existingUser, isNewUser: false });
        expect(createOAuthUserMock).not.toHaveBeenCalled();
    });

    it("creates a new user when role hint is present", async () => {
        const createdUser = {
            id: "user_2",
            email: "new@example.com",
            role: Role.PROFESSIONAL,
            onboardingRequired: true,
            onboardingCompleted: false,
        };

        mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrisma.user.findUnique.mockResolvedValue(null);
        createOAuthUserMock.mockResolvedValue(createdUser);

        const result = await OAuthService.resolveUserForOAuthSignIn({
            provider: "linkedin",
            providerAccountId: "provider-account-2",
            email: "new@example.com",
            roleHint: Role.PROFESSIONAL,
        });

        expect(createOAuthUserMock).toHaveBeenCalledWith("new@example.com", Role.PROFESSIONAL);
        expect(result).toEqual({ user: createdUser, isNewUser: true });
    });

    it("throws role_required when a new OAuth user has no role hint", async () => {
        mockPrisma.oAuthAccount.findUnique.mockResolvedValue(null);
        mockPrisma.user.findUnique.mockResolvedValue(null);

        await expect(
            OAuthService.resolveUserForOAuthSignIn({
                provider: "google",
                providerAccountId: "provider-account-3",
                email: "norole@example.com",
                roleHint: null,
            })
        ).rejects.toBeInstanceOf(OAuthRoleRequiredError);
    });

    it("blocks disconnecting the final login method", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            hashedPassword: null,
            oauthAccounts: [{ provider: "google" }],
        });

        await expect(OAuthService.disconnectProvider("user_1", "google")).rejects.toBeInstanceOf(
            OAuthDisconnectLastMethodError
        );
    });

    it("disconnects a provider when another login method exists", async () => {
        mockPrisma.user.findUnique
            .mockResolvedValueOnce({
                hashedPassword: "hashed",
                oauthAccounts: [{ provider: "google" }, { provider: "linkedin" }],
            })
            .mockResolvedValueOnce({
                hashedPassword: "hashed",
                oauthAccounts: [{ provider: "linkedin" }],
            });

        mockPrisma.oAuthAccount.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.oAuthAccount.findMany.mockResolvedValue([{ provider: "linkedin" }]);
        mockPrisma.user.update.mockResolvedValue({});

        const result = await OAuthService.disconnectProvider("user_1", "google");

        expect(mockPrisma.oAuthAccount.deleteMany).toHaveBeenCalledWith({
            where: { userId: "user_1", provider: "google" },
        });
        expect(result.providers.google).toBe(false);
        expect(result.providers.linkedin).toBe(true);
    });

    it("throws when disconnecting an unconnected provider", async () => {
        mockPrisma.user.findUnique.mockResolvedValue({
            hashedPassword: "hashed",
            oauthAccounts: [{ provider: "google" }],
        });

        await expect(OAuthService.disconnectProvider("user_1", "linkedin")).rejects.toBeInstanceOf(
            OAuthProviderNotConnectedError
        );
    });
});
