"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon";
import { appRoutes } from "@/lib/shared/routes";
import { AuthCard, AuthField, AuthMessage } from "@/components/ui/primitives/Auth";
import { Button } from "@/components/ui/primitives/Button";
import styles from "./AuthForms.module.css";

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
            <header className={styles.header}>
                <p className={styles.eyebrow}>Welcome Back</p>
                <h2 className={styles.title}>Sign in to Kafei</h2>
                <p className={styles.description}>Pick up where you left off.</p>
            </header>

            {signupSuccess && (
                <AuthMessage tone="success">
                    Account created successfully. Sign in to continue.
                </AuthMessage>
            )}

            <div className={styles.providerStack}>
                <Button
                    type="button"
                    onClick={() => handleOAuthSignIn("google")}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full justify-center"
                >
                    <OAuthProviderIcon provider="google" className="h-5 w-5" />
                    Continue with Google
                </Button>

                <Button
                    type="button"
                    onClick={() => handleOAuthSignIn("linkedin")}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full justify-center"
                >
                    <OAuthProviderIcon provider="linkedin" className="h-5 w-5" />
                    Continue with LinkedIn
                </Button>
            </div>

            <div className={styles.divider}>
                <span className={styles.dividerText}>Or continue with email</span>
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

                <div className={styles.helperRow}>
                    <Link href="/forgot-password" className={styles.textLink}>
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

            <div className={styles.footer}>
                <span>Don&apos;t have an account?</span>
                <Link href="/signup" className={styles.link}>
                    Sign up
                </Link>
            </div>
        </AuthCard>
    );
}
