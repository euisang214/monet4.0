"use client";

import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useSession } from "next-auth/react";

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const PDF_CONTENT_TYPE = "application/pdf";

type TimelineEntry = {
    company: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean | null;
    title: string;
    description?: string | null;
};

type EducationEntry = {
    school: string;
    location?: string | null;
    startDate: string;
    endDate?: string | null;
    isCurrent?: boolean | null;
    degree: string;
    fieldOfStudy: string;
    gpa?: number | null;
    honors?: string | null;
    activities?: string[] | null;
};

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
        employer?: string;
        title?: string;
        bio?: string;
        price?: number;
        corporateEmail?: string;
        interests?: string[] | null;
        experience?: TimelineEntry[] | null;
        activities?: TimelineEntry[] | null;
        education?: EducationEntry[] | null;
    };
}

type ExperienceFormEntry = {
    company: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    description: string;
};

type EducationFormEntry = {
    school: string;
    degree: string;
    fieldOfStudy: string;
    location: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    gpa: string;
    honors: string;
    activities: string;
};

function postOnboardingPath(role: Role) {
    return role === Role.PROFESSIONAL ? "/professional/dashboard" : "/candidate/browse";
}

function createEmptyExperienceEntry(): ExperienceFormEntry {
    return {
        company: "",
        title: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        description: "",
    };
}

function createEmptyEducationEntry(): EducationFormEntry {
    return {
        school: "",
        degree: "",
        fieldOfStudy: "",
        location: "",
        startDate: "",
        endDate: "",
        isCurrent: false,
        gpa: "",
        honors: "",
        activities: "",
    };
}

function mapTimelineEntries(entries?: TimelineEntry[] | null): ExperienceFormEntry[] {
    if (!entries || entries.length === 0) {
        return [createEmptyExperienceEntry()];
    }

    return entries.map((entry) => ({
        company: entry.company || "",
        title: entry.title || "",
        location: entry.location || "",
        startDate: entry.startDate || "",
        endDate: entry.endDate || "",
        isCurrent: Boolean(entry.isCurrent),
        description: entry.description || "",
    }));
}

function mapEducationEntries(entries?: EducationEntry[] | null): EducationFormEntry[] {
    if (!entries || entries.length === 0) {
        return [createEmptyEducationEntry()];
    }

    return entries.map((entry) => ({
        school: entry.school || "",
        degree: entry.degree || "",
        fieldOfStudy: entry.fieldOfStudy || "",
        location: entry.location || "",
        startDate: entry.startDate || "",
        endDate: entry.endDate || "",
        isCurrent: Boolean(entry.isCurrent),
        gpa: typeof entry.gpa === "number" ? entry.gpa.toString() : "",
        honors: entry.honors || "",
        activities: entry.activities?.join(", ") || "",
    }));
}

function normalizeCommaSeparated(value: string) {
    return Array.from(
        new Set(
            value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
        )
    );
}

function parseRequiredDate(value: string, label: string) {
    const parsed = new Date(value);
    if (!value || Number.isNaN(parsed.getTime())) {
        throw new Error(`${label} is required.`);
    }
    return parsed;
}

function parseOptionalDate(value: string, label: string) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error(`${label} is invalid.`);
    }
    return parsed;
}

function serializeExperienceEntries(entries: ExperienceFormEntry[], sectionName: string) {
    if (entries.length === 0) {
        throw new Error(`At least one ${sectionName.toLowerCase()} entry is required.`);
    }

    return entries.map((entry, index) => {
        const itemPrefix = `${sectionName} entry ${index + 1}`;
        const company = entry.company.trim();
        const title = entry.title.trim();
        const startDate = entry.startDate.trim();
        const endDate = entry.endDate.trim();

        if (!company) throw new Error(`${itemPrefix}: company is required.`);
        if (!title) throw new Error(`${itemPrefix}: title is required.`);

        const start = parseRequiredDate(startDate, `${itemPrefix} start date`);
        const end = entry.isCurrent ? null : parseOptionalDate(endDate, `${itemPrefix} end date`);
        if (end && end < start) {
            throw new Error(`${itemPrefix}: end date cannot be before start date.`);
        }

        return {
            company,
            title,
            location: entry.location.trim() || null,
            startDate,
            endDate: entry.isCurrent ? null : endDate || null,
            isCurrent: entry.isCurrent,
            description: entry.description.trim() || null,
        };
    });
}

function serializeEducationEntries(entries: EducationFormEntry[]) {
    if (entries.length === 0) {
        throw new Error("At least one education entry is required.");
    }

    return entries.map((entry, index) => {
        const itemPrefix = `Education entry ${index + 1}`;
        const school = entry.school.trim();
        const degree = entry.degree.trim();
        const fieldOfStudy = entry.fieldOfStudy.trim();
        const startDate = entry.startDate.trim();
        const endDate = entry.endDate.trim();

        if (!school) throw new Error(`${itemPrefix}: school is required.`);
        if (!degree) throw new Error(`${itemPrefix}: degree is required.`);
        if (!fieldOfStudy) throw new Error(`${itemPrefix}: field of study is required.`);

        const start = parseRequiredDate(startDate, `${itemPrefix} start date`);
        const end = entry.isCurrent ? null : parseOptionalDate(endDate, `${itemPrefix} end date`);
        if (end && end < start) {
            throw new Error(`${itemPrefix}: end date cannot be before start date.`);
        }

        const gpaValue = entry.gpa.trim();
        let gpa: number | null = null;
        if (gpaValue) {
            const parsedGpa = Number.parseFloat(gpaValue);
            if (!Number.isFinite(parsedGpa)) {
                throw new Error(`${itemPrefix}: GPA must be a valid number.`);
            }
            gpa = parsedGpa;
        }

        return {
            school,
            degree,
            fieldOfStudy,
            location: entry.location.trim() || null,
            startDate,
            endDate: entry.isCurrent ? null : endDate || null,
            isCurrent: entry.isCurrent,
            gpa,
            honors: entry.honors.trim() || null,
            activities: normalizeCommaSeparated(entry.activities),
        };
    });
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

    const [employer, setEmployer] = useState(initialProfessional?.employer || "");
    const [title, setTitle] = useState(initialProfessional?.title || "");
    const [bio, setBio] = useState(initialProfessional?.bio || "");
    const [price, setPrice] = useState(
        typeof initialProfessional?.price === "number" ? initialProfessional.price.toString() : ""
    );
    const [corporateEmail, setCorporateEmail] = useState(initialProfessional?.corporateEmail || "");
    const [professionalInterests, setProfessionalInterests] = useState(
        initialProfessional?.interests?.join(", ") || ""
    );

    const [experienceEntries, setExperienceEntries] = useState<ExperienceFormEntry[]>(
        role === Role.CANDIDATE
            ? mapTimelineEntries(initialCandidate?.experience)
            : mapTimelineEntries(initialProfessional?.experience)
    );
    const [activityEntries, setActivityEntries] = useState<ExperienceFormEntry[]>(
        role === Role.CANDIDATE
            ? mapTimelineEntries(initialCandidate?.activities)
            : mapTimelineEntries(initialProfessional?.activities)
    );
    const [educationEntries, setEducationEntries] = useState<EducationFormEntry[]>(
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

    const updateExperienceEntry = (
        setter: Dispatch<SetStateAction<ExperienceFormEntry[]>>,
        index: number,
        field: keyof ExperienceFormEntry,
        value: string | boolean
    ) => {
        setter((prev) =>
            prev.map((entry, currentIndex) => {
                if (currentIndex !== index) return entry;
                const next = { ...entry, [field]: value } as ExperienceFormEntry;
                if (field === "isCurrent" && value === true) {
                    next.endDate = "";
                }
                return next;
            })
        );
    };

    const updateEducationEntry = (
        index: number,
        field: keyof EducationFormEntry,
        value: string | boolean
    ) => {
        setEducationEntries((prev) =>
            prev.map((entry, currentIndex) => {
                if (currentIndex !== index) return entry;
                const next = { ...entry, [field]: value } as EducationFormEntry;
                if (field === "isCurrent" && value === true) {
                    next.endDate = "";
                }
                return next;
            })
        );
    };

    const removeExperienceEntry = (
        setter: Dispatch<SetStateAction<ExperienceFormEntry[]>>,
        index: number
    ) => {
        setter((prev) => (prev.length > 1 ? prev.filter((_, currentIndex) => currentIndex !== index) : prev));
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
                const parsedPrice = Number.parseFloat(price);
                if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                    throw new Error("Enter a valid hourly rate greater than zero.");
                }

                const interests = normalizeCommaSeparated(professionalInterests);
                if (interests.length === 0) {
                    throw new Error("At least one interest is required.");
                }

                payload.employer = employer.trim();
                payload.title = title.trim();
                payload.bio = bio.trim();
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
                                    type="text"
                                    value={candidateInterests}
                                    onChange={(event) => setCandidateInterests(event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Interview Prep, Networking, Career Advice"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
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

                            <div className="md:col-span-2">
                                <label htmlFor="bio" className="block text-sm font-medium mb-1">
                                    Bio
                                </label>
                                <textarea
                                    id="bio"
                                    required
                                    value={bio}
                                    onChange={(event) => setBio(event.target.value)}
                                    className="w-full p-2 border rounded-md h-28"
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

                            <div className="md:col-span-2">
                                <label htmlFor="professional-interests" className="block text-sm font-medium mb-1">
                                    Interests (comma separated)
                                </label>
                                <input
                                    id="professional-interests"
                                    required
                                    type="text"
                                    value={professionalInterests}
                                    onChange={(event) => setProfessionalInterests(event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Mentorship, Interview Coaching, Leadership"
                                />
                            </div>
                        </div>
                    )}
                </section>

                <section className="space-y-4 rounded-md border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Experience</h2>
                            <p className="text-xs text-gray-500">Add one or more experience entries.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setExperienceEntries((prev) => [...prev, createEmptyExperienceEntry()])}
                            className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                            Add experience
                        </button>
                    </div>

                    <div className="space-y-4">
                        {experienceEntries.map((entry, index) => (
                            <article key={`experience-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900">Experience #{index + 1}</h3>
                                    <button
                                        type="button"
                                        onClick={() => removeExperienceEntry(setExperienceEntries, index)}
                                        disabled={experienceEntries.length <= 1}
                                        className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                                    >
                                        Remove
                                    </button>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                        type="text"
                                        value={entry.title}
                                        onChange={(event) =>
                                            updateExperienceEntry(setExperienceEntries, index, "title", event.target.value)
                                        }
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Title"
                                    />
                                    <input
                                        type="text"
                                        value={entry.company}
                                        onChange={(event) =>
                                            updateExperienceEntry(setExperienceEntries, index, "company", event.target.value)
                                        }
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Company"
                                    />
                                    <input
                                        type="text"
                                        value={entry.location}
                                        onChange={(event) =>
                                            updateExperienceEntry(setExperienceEntries, index, "location", event.target.value)
                                        }
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Location (optional)"
                                    />
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={entry.isCurrent}
                                            onChange={(event) =>
                                                updateExperienceEntry(
                                                    setExperienceEntries,
                                                    index,
                                                    "isCurrent",
                                                    event.target.checked
                                                )
                                            }
                                        />
                                        Current role
                                    </label>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Start date</p>
                                        <input
                                            type="date"
                                            value={entry.startDate}
                                            onChange={(event) =>
                                                updateExperienceEntry(
                                                    setExperienceEntries,
                                                    index,
                                                    "startDate",
                                                    event.target.value
                                                )
                                            }
                                            className="w-full p-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">End date</p>
                                        <input
                                            type="date"
                                            value={entry.endDate}
                                            disabled={entry.isCurrent}
                                            onChange={(event) =>
                                                updateExperienceEntry(
                                                    setExperienceEntries,
                                                    index,
                                                    "endDate",
                                                    event.target.value
                                                )
                                            }
                                            className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                        />
                                    </div>
                                </div>

                                <textarea
                                    value={entry.description}
                                    onChange={(event) =>
                                        updateExperienceEntry(setExperienceEntries, index, "description", event.target.value)
                                    }
                                    className="w-full p-2 border rounded-md h-20"
                                    placeholder="Description (optional)"
                                />
                            </article>
                        ))}
                    </div>
                </section>

                <section className="space-y-4 rounded-md border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Activities</h2>
                            <p className="text-xs text-gray-500">Add one or more activity entries.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setActivityEntries((prev) => [...prev, createEmptyExperienceEntry()])}
                            className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                            Add activity
                        </button>
                    </div>

                    <div className="space-y-4">
                        {activityEntries.map((entry, index) => (
                            <article key={`activity-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900">Activity #{index + 1}</h3>
                                    <button
                                        type="button"
                                        onClick={() => removeExperienceEntry(setActivityEntries, index)}
                                        disabled={activityEntries.length <= 1}
                                        className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                                    >
                                        Remove
                                    </button>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                        type="text"
                                        value={entry.title}
                                        onChange={(event) =>
                                            updateExperienceEntry(setActivityEntries, index, "title", event.target.value)
                                        }
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Role / activity title"
                                    />
                                    <input
                                        type="text"
                                        value={entry.company}
                                        onChange={(event) =>
                                            updateExperienceEntry(setActivityEntries, index, "company", event.target.value)
                                        }
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Organization"
                                    />
                                    <input
                                        type="text"
                                        value={entry.location}
                                        onChange={(event) =>
                                            updateExperienceEntry(setActivityEntries, index, "location", event.target.value)
                                        }
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Location (optional)"
                                    />
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={entry.isCurrent}
                                            onChange={(event) =>
                                                updateExperienceEntry(
                                                    setActivityEntries,
                                                    index,
                                                    "isCurrent",
                                                    event.target.checked
                                                )
                                            }
                                        />
                                        Ongoing activity
                                    </label>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Start date</p>
                                        <input
                                            type="date"
                                            value={entry.startDate}
                                            onChange={(event) =>
                                                updateExperienceEntry(setActivityEntries, index, "startDate", event.target.value)
                                            }
                                            className="w-full p-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">End date</p>
                                        <input
                                            type="date"
                                            value={entry.endDate}
                                            disabled={entry.isCurrent}
                                            onChange={(event) =>
                                                updateExperienceEntry(setActivityEntries, index, "endDate", event.target.value)
                                            }
                                            className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                        />
                                    </div>
                                </div>

                                <textarea
                                    value={entry.description}
                                    onChange={(event) =>
                                        updateExperienceEntry(setActivityEntries, index, "description", event.target.value)
                                    }
                                    className="w-full p-2 border rounded-md h-20"
                                    placeholder="Description (optional)"
                                />
                            </article>
                        ))}
                    </div>
                </section>

                <section className="space-y-4 rounded-md border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Education</h2>
                            <p className="text-xs text-gray-500">Add one or more education entries.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEducationEntries((prev) => [...prev, createEmptyEducationEntry()])}
                            className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                            Add education
                        </button>
                    </div>

                    <div className="space-y-4">
                        {educationEntries.map((entry, index) => (
                            <article key={`education-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-gray-900">Education #{index + 1}</h3>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setEducationEntries((prev) =>
                                                prev.length > 1
                                                    ? prev.filter((_, currentIndex) => currentIndex !== index)
                                                    : prev
                                            )
                                        }
                                        disabled={educationEntries.length <= 1}
                                        className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                                    >
                                        Remove
                                    </button>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                        type="text"
                                        value={entry.school}
                                        onChange={(event) => updateEducationEntry(index, "school", event.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        placeholder="School"
                                    />
                                    <input
                                        type="text"
                                        value={entry.degree}
                                        onChange={(event) => updateEducationEntry(index, "degree", event.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Degree"
                                    />
                                    <input
                                        type="text"
                                        value={entry.fieldOfStudy}
                                        onChange={(event) => updateEducationEntry(index, "fieldOfStudy", event.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Field of study"
                                    />
                                    <input
                                        type="text"
                                        value={entry.location}
                                        onChange={(event) => updateEducationEntry(index, "location", event.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        placeholder="Location (optional)"
                                    />
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Start date</p>
                                        <input
                                            type="date"
                                            value={entry.startDate}
                                            onChange={(event) => updateEducationEntry(index, "startDate", event.target.value)}
                                            className="w-full p-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">End date</p>
                                        <input
                                            type="date"
                                            value={entry.endDate}
                                            disabled={entry.isCurrent}
                                            onChange={(event) => updateEducationEntry(index, "endDate", event.target.value)}
                                            className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                        />
                                    </div>
                                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={entry.isCurrent}
                                            onChange={(event) => updateEducationEntry(index, "isCurrent", event.target.checked)}
                                        />
                                        Currently studying here
                                    </label>
                                    <input
                                        type="text"
                                        value={entry.gpa}
                                        onChange={(event) => updateEducationEntry(index, "gpa", event.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        placeholder="GPA (optional)"
                                    />
                                </div>

                                <input
                                    type="text"
                                    value={entry.honors}
                                    onChange={(event) => updateEducationEntry(index, "honors", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Honors (optional)"
                                />
                                <input
                                    type="text"
                                    value={entry.activities}
                                    onChange={(event) => updateEducationEntry(index, "activities", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Education activities (comma separated, optional)"
                                />
                            </article>
                        ))}
                    </div>
                </section>

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
