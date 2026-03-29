"use client";

import Link from "next/link";
import { Role } from "@prisma/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { OAuthProviderIcon } from "@/components/auth/OAuthProviderIcon";
import { appRoutes } from "@/lib/shared/routes";
import { AuthCard, AuthField, AuthMessage } from "@/components/ui/primitives/Auth";
import { Button } from "@/components/ui/primitives/Button";
import styles from "./AuthForms.module.css";

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
            await signIn(provider, { callbackUrl: appRoutes.api.auth.callbackRedirect });
        } catch {
            setError("Unable to start social signup.");
            setIsLoading(false);
        }
    };

    const uploadResumeForSignup = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResponse = await fetch(appRoutes.api.auth.signupResume, {
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

            const res = await fetch(appRoutes.api.auth.signup, {
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
        <AuthCard>
            <header className={styles.header}>
                <p className={styles.eyebrow}>Get Started</p>
                <h2 className={styles.title}>Create your Kafei account</h2>
                <p className={styles.description}>Choose your role and we will set up the right workflow.</p>
            </header>

            <div className={styles.roleToggle}>
                <button
                    type="button"
                    onClick={() => setRole(Role.CANDIDATE)}
                    className={`${styles.roleOption} ${role === Role.CANDIDATE ? styles.roleOptionActive : ""}`}
                >
                    Candidate
                </button>
                <button
                    type="button"
                    onClick={() => setRole(Role.PROFESSIONAL)}
                    className={`${styles.roleOption} ${role === Role.PROFESSIONAL ? styles.roleOptionActive : ""}`}
                >
                    Professional
                </button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && <AuthMessage tone="error">{error}</AuthMessage>}

                <div className="space-y-3">
                    <AuthField
                        id="name"
                        name="name"
                        label="Full Name"
                        type="text"
                        required
                        placeholder="Full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
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
                        autoComplete="new-password"
                        required
                        placeholder="Password (min 6 chars)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {role === Role.CANDIDATE && (
                    <div className={styles.uploadPanel}>
                        <label htmlFor="resume" className={styles.uploadLabel}>
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
                            className="block w-full text-sm"
                        />
                        <p className={styles.uploadHint}>
                            {resumeFile
                                ? `Selected file: ${resumeFile.name}`
                                : "Upload a PDF resume (max 4MB) to continue."}
                        </p>
                    </div>
                )}

                <Button
                    type="submit"
                    disabled={isLoading}
                    variant="primary"
                    className="w-full justify-center"
                >
                    {isUploadingResume ? "Uploading resume..." : isLoading ? "Creating account..." : "Create account"}
                </Button>
            </form>

            <div className={styles.providerStack}>
                <Button
                    type="button"
                    onClick={() => void handleOAuthSignup("google")}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full justify-center"
                >
                    <OAuthProviderIcon provider="google" className="h-5 w-5" />
                    Continue with Google
                </Button>
                <Button
                    type="button"
                    onClick={() => void handleOAuthSignup("linkedin")}
                    disabled={isLoading}
                    variant="ghost"
                    className="w-full justify-center"
                >
                    <OAuthProviderIcon provider="linkedin" className="h-5 w-5" />
                    Continue with LinkedIn
                </Button>
            </div>

            <div className={styles.footer}>
                <span>Already have an account?</span>
                <Link href="/login" className={styles.link}>
                    Sign in
                </Link>
            </div>
        </AuthCard>
    );
}
