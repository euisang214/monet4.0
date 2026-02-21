"use client";

import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ProfessionalProfileFields } from "@/components/profile/ProfessionalProfileFields";
import { TimelineSectionsEditor } from "@/components/profile/TimelineSectionsEditor";
import {
    EducationEntry,
    ensureExactlyOneCurrentExperience,
    mapEducationEntries,
    mapTimelineEntries,
    normalizeCommaSeparated,
    serializeEducationEntries,
    serializeExperienceEntries,
    TimelineEntry,
} from "@/components/profile/timeline-form";

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const PDF_CONTENT_TYPE = "application/pdf";

interface OnboardingFormProps {
    role: Role;
    initialTimezone: string;
    initialCandidate?: {
        resumeUrl?: string | null;
        interests?: string[] | null;
        experience?: TimelineEntry[] | null;
        activities?: TimelineEntry[] | null;
        education?: EducationEntry[] | null;
    };
    initialProfessional?: {
        bio?: string;
        price?: number;
        corporateEmail?: string;
        interests?: string[] | null;
        experience?: TimelineEntry[] | null;
        activities?: TimelineEntry[] | null;
        education?: EducationEntry[] | null;
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
    const [candidateInterests, setCandidateInterests] = useState(initialCandidate?.interests?.join(", ") || "");

    const [bio, setBio] = useState(initialProfessional?.bio || "");
    const [price, setPrice] = useState(
        typeof initialProfessional?.price === "number" ? initialProfessional.price.toString() : ""
    );
    const [corporateEmail, setCorporateEmail] = useState(initialProfessional?.corporateEmail || "");
    const [professionalInterests, setProfessionalInterests] = useState(
        initialProfessional?.interests?.join(", ") || ""
    );

    const [experienceEntries, setExperienceEntries] = useState(
        role === Role.CANDIDATE
            ? mapTimelineEntries(initialCandidate?.experience)
            : mapTimelineEntries(initialProfessional?.experience, { enforceSingleCurrent: true })
    );
    const [activityEntries, setActivityEntries] = useState(
        role === Role.CANDIDATE
            ? mapTimelineEntries(initialCandidate?.activities)
            : mapTimelineEntries(initialProfessional?.activities)
    );
    const [educationEntries, setEducationEntries] = useState(
        role === Role.CANDIDATE
            ? mapEducationEntries(initialCandidate?.education)
            : mapEducationEntries(initialProfessional?.education)
    );

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
            const payload: Record<string, unknown> = {
                timezone: timezone.trim() || "UTC",
                experience: serializeExperienceEntries(experienceEntries, "Experience"),
                activities: serializeExperienceEntries(activityEntries, "Activity"),
                education: serializeEducationEntries(educationEntries),
            };

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

                const interests = normalizeCommaSeparated(candidateInterests);
                if (interests.length === 0) {
                    throw new Error("At least one interest is required.");
                }

                payload.resumeUrl = resumeUrl;
                payload.interests = interests;
            } else {
                if (!ensureExactlyOneCurrentExperience(experienceEntries)) {
                    throw new Error("Select exactly one current role in your experience.");
                }

                const parsedPrice = Number.parseFloat(price);
                if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                    throw new Error("Enter a valid hourly rate greater than zero.");
                }

                const interests = normalizeCommaSeparated(professionalInterests);
                if (interests.length === 0) {
                    throw new Error("At least one interest is required.");
                }

                const trimmedBio = bio.trim();
                if (!trimmedBio) {
                    throw new Error("Bio is required.");
                }

                payload.bio = trimmedBio;
                payload.price = parsedPrice;
                payload.corporateEmail = corporateEmail.trim();
                payload.interests = interests;
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
        <section className="w-full max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg">
            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Onboarding</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Finish setting up your profile</h1>
                <p className="text-sm text-gray-600">
                    Complete required fields to continue as a {role === Role.PROFESSIONAL ? "professional" : "candidate"}.
                </p>
            </header>

            <form className="space-y-8" onSubmit={handleSubmit}>
                {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

                <section className="space-y-4 rounded-md border border-gray-200 p-4">
                    <h2 className="text-lg font-semibold text-gray-900">Account basics</h2>

                    <div>
                        <label htmlFor="timezone" className="block text-sm font-medium mb-1">
                            Timezone
                        </label>
                        <input
                            id="timezone"
                            required
                            disabled={isLoading}
                            type="text"
                            value={timezone}
                            onChange={(event) => setTimezone(event.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="America/New_York"
                        />
                    </div>

                    {role === Role.CANDIDATE ? (
                        <>
                            <div>
                                <label htmlFor="resume" className="block text-sm font-medium mb-1">
                                    Resume (PDF)
                                </label>
                                {candidateResumeUrl ? (
                                    <p className="text-xs text-gray-500">
                                        A resume is already on file. Upload another file only if you want to replace it.
                                    </p>
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
                                {candidateResumeFile ? (
                                    <p className="text-xs text-gray-500">Selected file: {candidateResumeFile.name}</p>
                                ) : null}
                            </div>

                            <div>
                                <label htmlFor="candidate-interests" className="block text-sm font-medium mb-1">
                                    Interests (comma separated)
                                </label>
                                <input
                                    id="candidate-interests"
                                    required
                                    disabled={isLoading}
                                    type="text"
                                    value={candidateInterests}
                                    onChange={(event) => setCandidateInterests(event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Interview Prep, Networking, Career Advice"
                                />
                            </div>
                        </>
                    ) : (
                        <ProfessionalProfileFields
                            bio={bio}
                            onBioChange={setBio}
                            price={price}
                            onPriceChange={setPrice}
                            corporateEmail={corporateEmail}
                            onCorporateEmailChange={setCorporateEmail}
                            interests={professionalInterests}
                            onInterestsChange={setProfessionalInterests}
                            disabled={isLoading}
                        />
                    )}
                </section>

                <TimelineSectionsEditor
                    experienceEntries={experienceEntries}
                    setExperienceEntries={setExperienceEntries}
                    activityEntries={activityEntries}
                    setActivityEntries={setActivityEntries}
                    educationEntries={educationEntries}
                    setEducationEntries={setEducationEntries}
                    enforceSingleCurrentExperience={role === Role.PROFESSIONAL}
                    disabled={isLoading}
                />

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
