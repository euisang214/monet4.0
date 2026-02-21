"use client";

import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const PDF_CONTENT_TYPE = "application/pdf";

interface OnboardingFormProps {
    role: Role;
    initialTimezone: string;
    initialCandidate?: {
        resumeUrl?: string | null;
        interests?: string[] | null;
    };
    initialProfessional?: {
        employer?: string;
        title?: string;
        bio?: string;
        price?: number;
        corporateEmail?: string;
    };
}

function postOnboardingPath(role: Role) {
    return role === Role.PROFESSIONAL ? "/professional/dashboard" : "/candidate/browse";
}

export function OnboardingForm({
    role,
    initialTimezone,
    initialCandidate,
    initialProfessional,
}: OnboardingFormProps) {
    const router = useRouter();
    const { update } = useSession();
    const [timezone, setTimezone] = useState(initialTimezone || "UTC");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isUploadingResume, setIsUploadingResume] = useState(false);

    const [candidateResumeUrl, setCandidateResumeUrl] = useState(initialCandidate?.resumeUrl || "");
    const [candidateResumeFile, setCandidateResumeFile] = useState<File | null>(null);
    const [candidateInterests, setCandidateInterests] = useState(
        initialCandidate?.interests?.join(", ") || ""
    );

    const [employer, setEmployer] = useState(initialProfessional?.employer || "");
    const [title, setTitle] = useState(initialProfessional?.title || "");
    const [bio, setBio] = useState(initialProfessional?.bio || "");
    const [price, setPrice] = useState(
        typeof initialProfessional?.price === "number" ? initialProfessional.price.toString() : ""
    );
    const [corporateEmail, setCorporateEmail] = useState(initialProfessional?.corporateEmail || "");

    const uploadResume = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/auth/signup/resume", {
            method: "POST",
            body: formData,
        });

        const payload = (await response.json().catch(() => null)) as
            | { data?: { storageUrl?: string }; error?: string }
            | null;

        if (!response.ok) {
            throw new Error(payload?.error || "Failed to upload resume");
        }

        const storageUrl = payload?.data?.storageUrl;
        if (!storageUrl) {
            throw new Error("Resume upload response did not include a storage URL");
        }
        return storageUrl;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const payload: Record<string, unknown> = { timezone };

            if (role === Role.CANDIDATE) {
                let resumeUrl = candidateResumeUrl;

                if (candidateResumeFile) {
                    if (candidateResumeFile.size > MAX_RESUME_SIZE_BYTES) {
                        throw new Error("Resume must be 4MB or smaller.");
                    }
                    const isPdf =
                        candidateResumeFile.type === PDF_CONTENT_TYPE ||
                        candidateResumeFile.name.toLowerCase().endsWith(".pdf");
                    if (!isPdf) {
                        throw new Error("Resume must be a PDF.");
                    }
                    setIsUploadingResume(true);
                    resumeUrl = await uploadResume(candidateResumeFile);
                    setCandidateResumeUrl(resumeUrl);
                    setIsUploadingResume(false);
                }

                if (!resumeUrl) {
                    throw new Error("Resume is required.");
                }

                const interests = candidateInterests
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean);
                if (interests.length === 0) {
                    throw new Error("At least one interest is required.");
                }

                payload.resumeUrl = resumeUrl;
                payload.interests = interests;
            } else {
                const parsedPrice = Number.parseFloat(price);
                if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                    throw new Error("Enter a valid hourly rate greater than zero.");
                }

                payload.employer = employer.trim();
                payload.title = title.trim();
                payload.bio = bio.trim();
                payload.price = parsedPrice;
                payload.corporateEmail = corporateEmail.trim();
            }

            const response = await fetch("/api/auth/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = (await response.json().catch(() => null)) as
                | { error?: string; data?: { onboardingRequired?: boolean; onboardingCompleted?: boolean } }
                | null;

            if (!response.ok) {
                throw new Error(result?.error || "Failed to complete onboarding");
            }

            await update({
                user: {
                    onboardingRequired: result?.data?.onboardingRequired ?? true,
                    onboardingCompleted: result?.data?.onboardingCompleted ?? true,
                },
            });

            router.push(postOnboardingPath(role));
            router.refresh();
        } catch (submitError) {
            if (submitError instanceof Error) {
                setError(submitError.message);
            } else {
                setError("Unable to complete onboarding.");
            }
        } finally {
            setIsUploadingResume(false);
            setIsLoading(false);
        }
    };

    return (
        <section className="w-full max-w-2xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg">
            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Onboarding</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Finish setting up your profile</h1>
                <p className="text-sm text-gray-600">
                    Complete required fields to continue as a {role === Role.PROFESSIONAL ? "professional" : "candidate"}.
                </p>
            </header>

            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                <div>
                    <label htmlFor="timezone" className="block text-sm font-medium mb-1">
                        Timezone
                    </label>
                    <input
                        id="timezone"
                        type="text"
                        required
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="America/New_York"
                    />
                </div>

                {role === Role.CANDIDATE ? (
                    <>
                        <div className="rounded-md border border-gray-300 p-4 space-y-2">
                            <label htmlFor="resume" className="block text-sm font-medium text-gray-700">
                                Resume (PDF required)
                            </label>
                            {candidateResumeUrl ? (
                                <p className="text-xs text-gray-500">A resume is already on file. Upload to replace it.</p>
                            ) : (
                                <p className="text-xs text-gray-500">Upload a PDF resume to continue.</p>
                            )}
                            <input
                                id="resume"
                                name="resume"
                                type="file"
                                accept=".pdf,application/pdf"
                                disabled={isLoading}
                                onChange={(event) => setCandidateResumeFile(event.target.files?.[0] ?? null)}
                                className="block w-full text-sm text-gray-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-md file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100"
                            />
                        </div>

                        <div>
                            <label htmlFor="candidate-interests" className="block text-sm font-medium mb-1">
                                Interests (comma separated)
                            </label>
                            <input
                                id="candidate-interests"
                                required
                                type="text"
                                value={candidateInterests}
                                onChange={(event) => setCandidateInterests(event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Interview Prep, Networking, Career Advice"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <label htmlFor="employer" className="block text-sm font-medium mb-1">
                                Current employer
                            </label>
                            <input
                                id="employer"
                                type="text"
                                required
                                value={employer}
                                onChange={(event) => setEmployer(event.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>

                        <div>
                            <label htmlFor="title" className="block text-sm font-medium mb-1">
                                Job title
                            </label>
                            <input
                                id="title"
                                type="text"
                                required
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>

                        <div>
                            <label htmlFor="bio" className="block text-sm font-medium mb-1">
                                Bio
                            </label>
                            <textarea
                                id="bio"
                                required
                                value={bio}
                                onChange={(event) => setBio(event.target.value)}
                                className="w-full p-2 border rounded-md h-32"
                            />
                        </div>

                        <div>
                            <label htmlFor="price" className="block text-sm font-medium mb-1">
                                Hourly rate ($)
                            </label>
                            <input
                                id="price"
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={price}
                                onChange={(event) => setPrice(event.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>

                        <div>
                            <label htmlFor="corporate-email" className="block text-sm font-medium mb-1">
                                Corporate email
                            </label>
                            <input
                                id="corporate-email"
                                required
                                type="email"
                                value={corporateEmail}
                                onChange={(event) => setCorporateEmail(event.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                    </>
                )}

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
                >
                    {isUploadingResume ? "Uploading resume..." : isLoading ? "Saving..." : "Complete onboarding"}
                </button>
            </form>
        </section>
    );
}
