"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Role } from "@prisma/client";

export function SignupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Role selector state, default to query param or CANDIDATE
    const initialRole = searchParams.get("role") === "professional" ? Role.PROFESSIONAL : Role.CANDIDATE;

    const [role, setRole] = useState<Role>(initialRole);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Signup failed");
            }

            // Automatically sign in or redirect to login
            // For simplicity, redirecting to login with a success message could be better, 
            // but auto-login is smoother. NextAuth doesn't support auto-login server-side easily without credentials.
            // We'll redirect to login for now to be safe and verify credentials.
            router.push("/login?signup=success");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
            <div className="text-center">
                <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Create your account</h2>
            </div>

            {/* Role Toggle */}
            <div className="flex justify-center space-x-4 mb-6">
                <button
                    onClick={() => setRole(Role.CANDIDATE)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${role === Role.CANDIDATE
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Join as Candidate
                </button>
                <button
                    onClick={() => setRole(Role.PROFESSIONAL)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${role === Role.PROFESSIONAL
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Join as Professional
                </button>
            </div>

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                {error && (
                    <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}
                <div className="-space-y-px rounded-md shadow-sm">
                    <div>
                        <label htmlFor="name" className="sr-only">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email address</label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="relative block w-full appearance-none border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
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
                            autoComplete="new-password"
                            required
                            className="relative block w-full appearance-none rounded-none rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                            placeholder="Password (min 6 chars)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="group relative flex w-full justify-center rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isLoading ? "Creating account..." : "Sign up"}
                    </button>
                </div>
            </form>
            <div className="text-center text-sm">
                <span className="text-gray-500">Already have an account? </span>
                <a href="/login" className="font-medium text-black hover:underline">
                    Sign in
                </a>
            </div>
        </div>
    );
}
