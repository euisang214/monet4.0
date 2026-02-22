"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon";
import { appRoutes } from "@/lib/shared/routes";

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
        <section className="w-full max-w-md mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg space-y-6">
            <header className="text-center">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Welcome Back</p>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Sign in to Monet</h2>
                <p className="text-sm text-gray-600">Pick up where you left off.</p>
            </header>

            {signupSuccess && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                    Account created successfully. Sign in to continue.
                </div>
            )}

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    <OAuthProviderIcon provider="google" className="h-5 w-5" />
                    Continue with Google
                </button>

                <button
                    type="button"
                    onClick={() => handleOAuthSignIn("linkedin")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    <OAuthProviderIcon provider="linkedin" className="h-5 w-5" />
                    Continue with LinkedIn
                </button>
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
                {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}
                <div className="space-y-3">
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="sr-only">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between p-3">
                    <Link href="/forgot-password" className="text-sm font-medium text-gray-600 hover:text-black">
                        Forgot your password?
                    </Link>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative flex w-full justify-center rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                >
                    {isLoading ? "Signing in..." : "Sign in"}
                </button>
            </form>

            <div className="text-center text-sm">
                <span className="text-gray-500">Don&apos;t have an account? </span>
                <Link href="/signup" className="font-medium text-black hover:underline">
                    Sign up
                </Link>
            </div>
        </section>
    );
}
