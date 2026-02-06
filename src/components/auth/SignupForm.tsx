"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export function SignupForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialRole = useMemo(
        () => (searchParams.get("role") === "professional" ? Role.PROFESSIONAL : Role.CANDIDATE),
        [searchParams]
    );

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

            router.push("/login?signup=success");
        } catch (error: unknown) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Could not create account");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <section className="w-full max-w-md bg-white p-8 rounded-xl border border-gray-200 shadow-lg space-y-6">
            <header className="text-center">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Get Started</p>
                <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Create your Monet account</h2>
                <p className="text-sm text-gray-600">Choose your role and we will set up the right workflow.</p>
            </header>

            <div className="bg-gray-100 rounded-full p-1 grid grid-cols-2 gap-1">
                <button
                    type="button"
                    onClick={() => setRole(Role.CANDIDATE)}
                    className={`rounded-full text-sm font-medium py-2 transition-colors ${role === Role.CANDIDATE
                        ? "bg-black text-white"
                        : "bg-transparent text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Candidate
                </button>
                <button
                    type="button"
                    onClick={() => setRole(Role.PROFESSIONAL)}
                    className={`rounded-full text-sm font-medium py-2 transition-colors ${role === Role.PROFESSIONAL
                        ? "bg-black text-white"
                        : "bg-transparent text-gray-600 hover:bg-gray-200"
                        }`}
                >
                    Professional
                </button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                <div className="-space-y-px rounded-md shadow-sm">
                    <div>
                        <label htmlFor="name" className="sr-only">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="relative block w-full appearance-none rounded-none rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                            placeholder="Full name"
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

                <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative flex w-full justify-center rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                >
                    {isLoading ? "Creating account..." : "Create account"}
                </button>
            </form>

            <div className="text-center text-sm">
                <span className="text-gray-500">Already have an account? </span>
                <Link href="/login" className="font-medium text-black hover:underline">
                    Sign in
                </Link>
            </div>
        </section>
    );
}
