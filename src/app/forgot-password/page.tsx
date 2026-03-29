"use client";

import Link from "next/link";
import { useState } from "react";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { appRoutes } from "@/lib/shared/routes";
import { AuthCard, AuthField, AuthMessage, AuthShell } from "@/components/ui/primitives/Auth";
import { Button, buttonVariants } from "@/components/ui/primitives/Button";
import styles from "@/components/auth/AuthForms.module.css";

type RequestStatus = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<RequestStatus>("idle");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setMessage("");

        try {
            const res = await fetch(appRoutes.api.auth.forgotPassword, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Something went wrong");
            }

            setStatus("success");
            setMessage(data.message || "Reset link sent. Please check your inbox.");
        } catch (error: unknown) {
            setStatus("error");
            if (error instanceof Error) {
                setMessage(error.message);
            } else {
                setMessage("Could not send reset link");
            }
        }
    };

    return (
        <main className="min-h-screen flex flex-col">
            <PublicNavbar />

            <AuthShell className="flex-1">
                <AuthCard>
                    <header className={styles.header}>
                        <p className={styles.eyebrow}>Reset Password</p>
                        <h2 className={styles.title}>Forgot your password?</h2>
                        <p className={styles.description}>Enter your email and we&apos;ll send a reset link.</p>
                    </header>

                    {status === "success" ? (
                        <AuthMessage tone="success" className="space-y-4 p-4">
                            <p>{message}</p>
                            <Link href="/login" className={buttonVariants({ variant: "secondary" })}>
                                Return to login
                            </Link>
                        </AuthMessage>
                    ) : (
                        <form className="space-y-5" onSubmit={handleSubmit}>
                            {status === "error" && <AuthMessage tone="error">{message}</AuthMessage>}

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

                            <Button
                                type="submit"
                                disabled={status === "loading"}
                                variant="primary"
                                className="w-full justify-center"
                            >
                                {status === "loading" ? "Sending..." : "Send reset link"}
                            </Button>
                        </form>
                    )}

                    <div className={styles.footer}>
                        <span>Remembered your password?</span>
                        <Link href="/login" className={styles.link}>
                            Sign in
                        </Link>
                    </div>
                </AuthCard>
            </AuthShell>
        </main>
    );
}
