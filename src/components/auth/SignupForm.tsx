"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const PDF_CONTENT_TYPE = "application/pdf";

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
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isUploadingResume, setIsUploadingResume] = useState(false);

    const setOAuthIntent = (selectedRole: Role) => {
        document.cookie = `oauth_role_intent=${selectedRole}; Path=/; Max-Age=600; SameSite=Lax`;
    };

    const handleOAuthSignup = async (provider: "google" | "linkedin") => {
        setError("");
        setIsLoading(true);
        try {
            setOAuthIntent(role);
            await signIn(provider, { callbackUrl: "/api/auth/callback-redirect" });
        } catch {
            setError("Unable to start social signup.");
            setIsLoading(false);
        }
    };

    const uploadResumeForSignup = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch("/api/auth/signup/resume", {
            method: "POST",
            body: formData,
        });

        const payload = (await uploadResponse.json().catch(() => null)) as
            | { data?: { storageUrl?: string; viewUrl?: string }; error?: string }
            | null;

        if (!uploadResponse.ok) {
            throw new Error(payload?.error || "Failed to upload resume");
        }

        const storageUrl = payload?.data?.storageUrl;

        if (!storageUrl) {
            throw new Error("Resume storage URL is missing");
        }

        return storageUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            let resumeUrl: string | undefined;

            if (role === Role.CANDIDATE) {
                if (!resumeFile) {
                    throw new Error("Resume upload is required for candidates");
                }

                if (resumeFile.size > MAX_RESUME_SIZE_BYTES) {
                    throw new Error("Resume must be 4MB or smaller");
                }

                const isPdf =
                    resumeFile.type === PDF_CONTENT_TYPE || resumeFile.name.toLowerCase().endsWith(".pdf");
                if (!isPdf) {
                    throw new Error("Resume must be uploaded as a PDF");
                }

                setIsUploadingResume(true);
                resumeUrl = await uploadResumeForSignup(resumeFile);
                setIsUploadingResume(false);
            }

            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, role, resumeUrl }),
            });

            const data = await res.json().catch(() => null);

            if (!res.ok) {
                const errorMessage = (data as { error?: string } | null)?.error || "Signup failed";
                throw new Error(errorMessage);
            }
            const signInResult = await signIn("credentials", {
                redirect: false,
                email,
                password,
                callbackUrl: "/onboarding",
            });

            if (signInResult?.error) {
                throw new Error("Account created, but automatic sign-in failed.");
            }

            router.push("/onboarding");
            router.refresh();
        } catch (error: unknown) {
            if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Could not create account");
            }
        } finally {
            setIsUploadingResume(false);
            setIsLoading(false);
        }
    };

    return (
        <section className="w-full max-w-md mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg space-y-6">
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

            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                <div className="space-y-3">
                    <div>
                        <label htmlFor="name" className="sr-only">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
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
                            autoComplete="new-password"
                            required
                            className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                            placeholder="Password (min 6 chars)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                {role === Role.CANDIDATE && (
                    <div className="rounded-md border border-gray-300 p-4 space-y-2">
                        <label htmlFor="resume" className="block text-sm font-medium text-gray-700">
                            Resume (PDF required)
                        </label>
                        <input
                            id="resume"
                            name="resume"
                            type="file"
                            accept=".pdf,application/pdf"
                            required
                            disabled={isLoading}
                            onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500">
                            {resumeFile
                                ? `Selected file: ${resumeFile.name}`
                                : "Upload a PDF resume (max 4MB) to continue."}
                        </p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative flex w-full justify-center rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                >
                    {isUploadingResume ? "Uploading resume..." : isLoading ? "Creating account..." : "Create account"}
                </button>
            </form>

            <div className="space-y-3">
                <button
                    type="button"
                    onClick={() => void handleOAuthSignup("google")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    Continue with Google
                </button>
                <button
                    type="button"
                    onClick={() => void handleOAuthSignup("linkedin")}
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    Continue with LinkedIn
                </button>
            </div>

            <div className="text-center text-sm">
                <span className="text-gray-500">Already have an account? </span>
                <Link href="/login" className="font-medium text-black hover:underline">
                    Sign in
                </Link>
            </div>
        </section>
    );
}
