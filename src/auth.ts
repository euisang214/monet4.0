import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import { z } from "zod";
import { prisma } from "@/lib/core/db";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { OAuthService, type SupportedOAuthProvider } from "@/lib/domain/auth/oauth-service";

const authSecret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
const googleClientId = process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret =
    process.env.AUTH_GOOGLE_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();
const linkedInClientId =
    process.env.AUTH_LINKEDIN_ID?.trim() || process.env.LINKEDIN_CLIENT_ID?.trim();
const linkedInClientSecret =
    process.env.AUTH_LINKEDIN_SECRET?.trim() || process.env.LINKEDIN_CLIENT_SECRET?.trim();

const OAUTH_ROLE_INTENT_COOKIE = "oauth_role_intent";

if (!authSecret) {
    throw new Error("Missing AUTH_SECRET or NEXTAUTH_SECRET in environment.");
}

function parseRoleHint(rawRole: string | null | undefined): Role | null {
    if (!rawRole) return null;

    const normalized = rawRole.trim().toUpperCase();
    if (normalized === Role.CANDIDATE) return Role.CANDIDATE;
    if (normalized === Role.PROFESSIONAL) return Role.PROFESSIONAL;
    return null;
}

function isOAuthProvider(provider: string): provider is SupportedOAuthProvider {
    return provider === "google" || provider === "linkedin";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth((req) => {
    const roleHint = parseRoleHint(req?.cookies?.get(OAUTH_ROLE_INTENT_COOKIE)?.value ?? null);

    return {
        secret: authSecret,
        providers: [
            Google({
                clientId: googleClientId,
                clientSecret: googleClientSecret,
                authorization: {
                    params: {
                        scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
                        access_type: "offline",
                        prompt: "consent",
                    },
                },
            }),
            LinkedIn({
                clientId: linkedInClientId,
                clientSecret: linkedInClientSecret,
            }),
            Credentials({
                name: "credentials",
                credentials: {
                    email: { label: "Email", type: "email" },
                    password: { label: "Password", type: "password" },
                },
                authorize: async (credentials) => {
                    const parsedCredentials = z
                        .object({ email: z.string().email(), password: z.string().min(6) })
                        .safeParse(credentials);

                    if (!parsedCredentials.success) {
                        return null;
                    }

                    const { email, password } = parsedCredentials.data;
                    const user = await prisma.user.findUnique({
                        where: { email },
                    });

                    if (!user || !user.hashedPassword) {
                        return null;
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.hashedPassword);
                    if (!passwordsMatch) {
                        return null;
                    }

                    return user;
                },
            }),
        ],
        callbacks: {
            async signIn({ user, account }) {
                if (!account || !isOAuthProvider(account.provider)) {
                    return true;
                }

                if (!account.providerAccountId) {
                    return false;
                }

                const existingUser = await OAuthService.findExistingUserForOAuth(
                    account.provider,
                    account.providerAccountId,
                    user.email
                );

                if (!existingUser && !user.email) {
                    return "/signup?error=oauth_email_required";
                }

                if (!existingUser && !roleHint) {
                    return "/signup?error=role_required";
                }

                return true;
            },
            async jwt({ token, user, account, trigger, session }) {
                if (trigger === "update" && session?.user) {
                    const sessionUser = session.user as {
                        onboardingRequired?: boolean;
                        onboardingCompleted?: boolean;
                    };

                    if (typeof sessionUser.onboardingRequired === "boolean") {
                        token.onboardingRequired = sessionUser.onboardingRequired;
                    }
                    if (typeof sessionUser.onboardingCompleted === "boolean") {
                        token.onboardingCompleted = sessionUser.onboardingCompleted;
                    }
                }

                if (account && isOAuthProvider(account.provider) && account.providerAccountId) {
                    const oauthUser = await OAuthService.resolveUserForOAuthSignIn({
                        provider: account.provider,
                        providerAccountId: account.providerAccountId,
                        email: user?.email ?? token.email ?? null,
                        roleHint,
                    });

                    const expiresAt =
                        typeof account.expires_at === "number"
                            ? new Date(account.expires_at * 1000)
                            : null;

                    await OAuthService.upsertOAuthAccount({
                        userId: oauthUser.user.id,
                        provider: account.provider,
                        providerAccountId: account.providerAccountId,
                        accessToken: account.access_token,
                        refreshToken: account.refresh_token,
                        expiresAt,
                        scope: account.scope,
                    });

                    token.id = oauthUser.user.id;
                    token.role = oauthUser.user.role;
                    token.email = oauthUser.user.email;
                    token.onboardingRequired = oauthUser.user.onboardingRequired;
                    token.onboardingCompleted = oauthUser.user.onboardingCompleted;
                    return token;
                }

                if (user) {
                    const credentialsUser = user as {
                        id?: string;
                        role?: Role;
                        onboardingRequired?: boolean;
                        onboardingCompleted?: boolean;
                    };

                    if (credentialsUser.id) token.id = credentialsUser.id;
                    if (credentialsUser.role) token.role = credentialsUser.role;
                    if (typeof credentialsUser.onboardingRequired === "boolean") {
                        token.onboardingRequired = credentialsUser.onboardingRequired;
                    }
                    if (typeof credentialsUser.onboardingCompleted === "boolean") {
                        token.onboardingCompleted = credentialsUser.onboardingCompleted;
                    }
                }

                if (
                    token.id &&
                    (typeof token.role === "undefined" ||
                        typeof token.onboardingRequired === "undefined" ||
                        typeof token.onboardingCompleted === "undefined")
                ) {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id },
                        select: {
                            role: true,
                            onboardingRequired: true,
                            onboardingCompleted: true,
                        },
                    });

                    if (dbUser) {
                        token.role = dbUser.role;
                        token.onboardingRequired = dbUser.onboardingRequired;
                        token.onboardingCompleted = dbUser.onboardingCompleted;
                    }
                }

                return token;
            },
            async session({ session, token }) {
                if (token && session.user) {
                    session.user.id = token.id as string;
                    session.user.role = token.role as Role;
                    session.user.onboardingRequired = Boolean(token.onboardingRequired);
                    session.user.onboardingCompleted = Boolean(token.onboardingCompleted);
                }
                return session;
            },
        },
        session: { strategy: "jwt" },
        pages: {
            signIn: "/login",
        },
    };
});
