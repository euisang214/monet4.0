"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const ROLE_REDIRECT_PATH = "/api/auth/callback-redirect";

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

    const handleOAuthSignIn = (provider: "google" | "linkedin") => {
        setIsLoading(true);
        signIn(provider, { callbackUrl });
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
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <button
                    onClick={() => handleOAuthSignIn("linkedin")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    <svg className="h-5 w-5 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9H12.909v1.632h.051c.496-.94 1.711-1.932 3.522-1.932 3.765 0 4.46 2.478 4.46 5.702v6.052zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
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
