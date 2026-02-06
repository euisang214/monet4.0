"use client";

import Link from "next/link";
import { useState } from "react";

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
            const res = await fetch("/api/auth/forgot-password", {
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
        <main className="min-h-screen py-12">
            <div className="container">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
                    <section className="hidden sm:block">
                        <p className="text-xs uppercase tracking-wider text-blue-600 mb-3">Account Recovery</p>
                        <h1 className="text-3xl font-bold text-gray-900 mb-3">Reset your password securely</h1>
                        <p className="text-gray-600">
                            We&apos;ll email a time-limited link so you can set a new password and regain access quickly.
                        </p>
                    </section>

                    <section className="w-full max-w-md bg-white p-8 rounded-xl border border-gray-200 shadow-lg space-y-6">
                        <header className="text-center">
                            <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Reset Password</p>
                            <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Forgot your password?</h2>
                            <p className="text-sm text-gray-600">Enter your email and we&apos;ll send a reset link.</p>
                        </header>

                        {status === "success" ? (
                            <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 space-y-4">
                                <p>{message}</p>
                                <Link href="/login" className="btn bg-green-50 text-green-800 hover:bg-green-100">
                                    Return to login
                                </Link>
                            </div>
                        ) : (
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                {status === "error" && (
                                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</div>
                                )}

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

                                <button
                                    type="submit"
                                    disabled={status === "loading"}
                                    className="group relative flex w-full justify-center rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                                >
                                    {status === "loading" ? "Sending..." : "Send reset link"}
                                </button>
                            </form>
                        )}

                        <div className="text-center text-sm">
                            <span className="text-gray-500">Remembered your password? </span>
                            <Link href="/login" className="font-medium text-black hover:underline">
                                Sign in
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
