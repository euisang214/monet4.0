"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon";
import { appRoutes } from "@/lib/shared/routes";
import { AuthCard, AuthField, AuthMessage } from "@/components/ui/primitives/Auth";
import { Button } from "@/components/ui/primitives/Button";

const ROLE_REDIRECT_PATH = appRoutes.api.auth.callbackRedirect;

function normalizeCallbackUrl(callbackUrl: string | null): string {
    if (!callbackUrl) return ROLE_REDIRECT_PATH;

    try {
        const parsed = new URL(callbackUrl, "http://localhost");
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return ROLE_REDIRECT_PATH;
        }

        const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        if (
            normalizedPath === "/" ||
            normalizedPath.startsWith("/login") ||
            normalizedPath.startsWith("/api/auth/signin")
        ) {
            return ROLE_REDIRECT_PATH;
        }

        return normalizedPath;
    } catch {
        return ROLE_REDIRECT_PATH;
    }
}

export function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const explicitCallbackUrl = searchParams.get("callbackUrl");
    const callbackUrl = normalizeCallbackUrl(explicitCallbackUrl);
    const signupSuccess = searchParams.get("signup") === "success";
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const clearOAuthIntent = () => {
        document.cookie = "oauth_role_intent=; Path=/; Max-Age=0; SameSite=Lax";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await signIn("credentials", {
                redirect: false,
                email,
                password,
                callbackUrl,
            });

            if (result?.error) {
                setError("Invalid email or password");
                return;
            }

            const redirectUrl = normalizeCallbackUrl(result?.url ?? callbackUrl);
            router.push(redirectUrl);
            router.refresh();
        } catch {
            setError("An unexpected error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOAuthSignIn = async (provider: "google" | "linkedin") => {
        setIsLoading(true);
        setError("");
        try {
            clearOAuthIntent();
            await signIn(provider, { callbackUrl });
        } catch {
            setError("Unable to start social sign-in");
            setIsLoading(false);
        }
    };

    return (
        <AuthCard>
            <header className="text-center">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Welcome Back</p>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Sign in to Monet</h2>
                <p className="text-sm text-gray-600">Pick up where you left off.</p>
            </header>

            {signupSuccess && (
                <AuthMessage tone="success">
                    Account created successfully. Sign in to continue.
                </AuthMessage>
            )}

            <div className="space-y-3">
                <Button
                    type="button"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full justify-center gap-3 shadow-sm"
                >
                    <OAuthProviderIcon provider="google" className="h-5 w-5" />
                    Continue with Google
                </Button>

                <Button
                    type="button"
                    onClick={() => handleOAuthSignIn("linkedin")}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full justify-center gap-3 shadow-sm"
                >
                    <OAuthProviderIcon provider="linkedin" className="h-5 w-5" />
                    Continue with LinkedIn
                </Button>
            </div>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-gray-500">Or continue with email</span>
                </div>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && <AuthMessage tone="error">{error}</AuthMessage>}
                <div className="space-y-3">
                    <AuthField
                        id="email-address"
                        name="email"
                        label="Email address"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <AuthField
                        id="password"
                        name="password"
                        label="Password"
                        type="password"
                        autoComplete="current-password"
                        required
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className="flex items-center justify-between p-3">
                    <Link href="/forgot-password" className="text-sm font-medium text-gray-600 hover:text-black">
                        Forgot your password?
                    </Link>
                </div>

                <Button
                    type="submit"
                    disabled={isLoading}
                    variant="primary"
                    className="w-full justify-center"
                >
                    {isLoading ? "Signing in..." : "Sign in"}
                </Button>
            </form>

            <div className="text-center text-sm">
                <span className="text-gray-500">Don&apos;t have an account? </span>
                <Link href="/signup" className="font-medium text-black hover:underline">
                    Sign up
                </Link>
            </div>
        </AuthCard>
    );
}
