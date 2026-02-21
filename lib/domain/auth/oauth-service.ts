import { prisma } from "@/lib/core/db";
import { Role } from "@prisma/client";
import { AuthService } from "@/lib/domain/auth/services";

export const SUPPORTED_OAUTH_PROVIDERS = ["google", "linkedin"] as const;
export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

export class OAuthRoleRequiredError extends Error {
    constructor() {
        super("role_required");
    }
}

export class OAuthDisconnectLastMethodError extends Error {
    constructor() {
        super("cannot_disconnect_last_method");
    }
}

export class OAuthProviderNotConnectedError extends Error {
    constructor() {
        super("provider_not_connected");
    }
}

function isSupportedProvider(provider: string): provider is SupportedOAuthProvider {
    return SUPPORTED_OAUTH_PROVIDERS.includes(provider as SupportedOAuthProvider);
}

async function updateProviderConnectionFlags(userId: string): Promise<void> {
    const accounts = await prisma.oAuthAccount.findMany({
        where: { userId },
        select: { provider: true },
    });

    const providers = new Set(accounts.map((account) => account.provider));

    await prisma.user.update({
        where: { id: userId },
        data: {
            googleCalendarConnected: providers.has("google"),
            linkedinConnected: providers.has("linkedin"),
        },
    });
}

export const OAuthService = {
    async findExistingUserForOAuth(
        provider: SupportedOAuthProvider,
        providerAccountId: string,
        email?: string | null
    ) {
        const linkedAccount = await prisma.oAuthAccount.findUnique({
            where: {
                provider_providerAccountId: {
                    provider,
                    providerAccountId,
                },
            },
            include: { user: true },
        });

        if (linkedAccount?.user) {
            return linkedAccount.user;
        }

        if (!email) {
            return null;
        }

        return prisma.user.findUnique({
            where: { email },
        });
    },

    async resolveUserForOAuthSignIn({
        provider,
        providerAccountId,
        email,
        roleHint,
    }: {
        provider: SupportedOAuthProvider;
        providerAccountId: string;
        email?: string | null;
        roleHint?: Role | null;
    }) {
        const existing = await this.findExistingUserForOAuth(provider, providerAccountId, email);
        if (existing) {
            return { user: existing, isNewUser: false };
        }

        if (!email || !roleHint) {
            throw new OAuthRoleRequiredError();
        }

        const created = await AuthService.createOAuthUser(email, roleHint);
        return { user: created, isNewUser: true };
    },

    async upsertOAuthAccount({
        userId,
        provider,
        providerAccountId,
        accessToken,
        refreshToken,
        expiresAt,
        scope,
    }: {
        userId: string;
        provider: SupportedOAuthProvider;
        providerAccountId: string;
        accessToken?: string | null;
        refreshToken?: string | null;
        expiresAt?: Date | null;
        scope?: string | null;
    }) {
        await prisma.oAuthAccount.upsert({
            where: {
                provider_providerAccountId: {
                    provider,
                    providerAccountId,
                },
            },
            create: {
                userId,
                provider,
                providerAccountId,
                accessToken: accessToken ?? null,
                refreshToken: refreshToken ?? null,
                expiresAt: expiresAt ?? null,
                scope: scope ?? null,
            },
            update: {
                userId,
                accessToken: accessToken ?? undefined,
                refreshToken: refreshToken ?? undefined,
                expiresAt: expiresAt ?? undefined,
                scope: scope ?? undefined,
            },
        });

        await updateProviderConnectionFlags(userId);
    },

    async getProviderStatus(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                hashedPassword: true,
                oauthAccounts: {
                    select: { provider: true },
                },
            },
        });

        if (!user) {
            throw new Error("user_not_found");
        }

        const providers = new Set(user.oauthAccounts.map((account) => account.provider));
        const hasPassword = Boolean(user.hashedPassword);
        const authMethodCount = providers.size + (hasPassword ? 1 : 0);

        const isConnected = {
            google: providers.has("google"),
            linkedin: providers.has("linkedin"),
        };

        const canDisconnect = {
            google: isConnected.google && authMethodCount > 1,
            linkedin: isConnected.linkedin && authMethodCount > 1,
        };

        return {
            hasPassword,
            providers: isConnected,
            canDisconnect,
        };
    },

    async disconnectProvider(userId: string, provider: string) {
        if (!isSupportedProvider(provider)) {
            throw new Error("invalid_provider");
        }

        const status = await this.getProviderStatus(userId);
        const connected = status.providers[provider];

        if (!connected) {
            throw new OAuthProviderNotConnectedError();
        }

        if (!status.canDisconnect[provider]) {
            throw new OAuthDisconnectLastMethodError();
        }

        await prisma.oAuthAccount.deleteMany({
            where: {
                userId,
                provider,
            },
        });

        await updateProviderConnectionFlags(userId);
        return this.getProviderStatus(userId);
    },
};
