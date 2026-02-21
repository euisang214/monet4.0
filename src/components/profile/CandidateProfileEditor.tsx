"use client";

import { ReactNode, useEffect, useState } from "react";
import { TimelineEntriesEditor } from "@/components/profile/shared/TimelineEntriesEditor";
import { EducationEntriesEditor } from "@/components/profile/shared/EducationEntriesEditor";
import { SUPPORTED_TIMEZONES, normalizeTimezone } from "@/lib/utils/supported-timezones";
import {
    EducationEntry,
    mapEducationEntries,
    mapTimelineEntries,
    normalizeCommaSeparated,
    serializeEducationEntries,
    serializeExperienceEntries,
    TimelineEntry,
    type SerializedEducationEntry,
    type SerializedTimelineEntry,
} from "@/components/profile/shared/profileFormAdapters";

const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
const PDF_CONTENT_TYPE = "application/pdf";

type CandidateProfileEditorMode = "onboarding" | "settings";

export type CandidateProfileEditorInitialData = {
    timezone?: string | null;
    resumeUrl?: string | null;
    resumeViewUrl?: string | null;
    interests?: string[] | null;
    experience?: TimelineEntry[] | null;
    activities?: TimelineEntry[] | null;
    education?: EducationEntry[] | null;
};

export type CandidateProfileSubmitPayload = {
    timezone: string;
    resumeUrl: string;
    interests: string[];
    experience: SerializedTimelineEntry[];
    activities: SerializedTimelineEntry[];
    education: SerializedEducationEntry[];
};

type CandidateProfileEditorProps = {
    mode: CandidateProfileEditorMode;
    initialData?: CandidateProfileEditorInitialData;
    onSubmit: (payload: CandidateProfileSubmitPayload) => Promise<void>;
    submitLabel: string;
    submittingLabel?: string;
    disabled?: boolean;
    footerContent?: ReactNode;
};

async function uploadCandidateResume(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/candidate/upload/resume", {
        method: "POST",
        body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
        | { data?: { storageUrl?: string; viewUrl?: string }; error?: string }
        | null;

    if (!response.ok) {
        throw new Error(payload?.error || "Failed to upload resume");
    }

    const storageUrl = payload?.data?.storageUrl;
    const viewUrl = payload?.data?.viewUrl;

    if (!storageUrl) {
        throw new Error("Resume upload response did not include a storage URL");
    }

    return {
        storageUrl,
        viewUrl: viewUrl || storageUrl,
    };
}

export function CandidateProfileEditor({
    mode,
    initialData,
    onSubmit,
    submitLabel,
    submittingLabel = "Saving...",
    disabled = false,
    footerContent,
}: CandidateProfileEditorProps) {
    const [timezone, setTimezone] = useState(normalizeTimezone(initialData?.timezone));
    const [candidateResumeUrl, setCandidateResumeUrl] = useState(initialData?.resumeUrl || "");
    const [candidateResumeViewUrl, setCandidateResumeViewUrl] = useState(
        initialData?.resumeViewUrl || initialData?.resumeUrl || ""
    );
    const [candidateResumeFile, setCandidateResumeFile] = useState<File | null>(null);
    const [candidateInterests, setCandidateInterests] = useState(initialData?.interests?.join(", ") || "");
    const [experienceEntries, setExperienceEntries] = useState(mapTimelineEntries(initialData?.experience));
    const [activityEntries, setActivityEntries] = useState(mapTimelineEntries(initialData?.activities));
    const [educationEntries, setEducationEntries] = useState(mapEducationEntries(initialData?.education));
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setTimezone(normalizeTimezone(initialData?.timezone));
        setCandidateResumeUrl(initialData?.resumeUrl || "");
        setCandidateResumeViewUrl(initialData?.resumeViewUrl || initialData?.resumeUrl || "");
        setCandidateResumeFile(null);
        setCandidateInterests(initialData?.interests?.join(", ") || "");
        setExperienceEntries(mapTimelineEntries(initialData?.experience));
        setActivityEntries(mapTimelineEntries(initialData?.activities));
        setEducationEntries(mapEducationEntries(initialData?.education));
    }, [initialData]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            let resumeUrl = candidateResumeUrl;
            let resumeViewUrl = candidateResumeViewUrl;

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

                const uploaded = await uploadCandidateResume(candidateResumeFile);
                resumeUrl = uploaded.storageUrl;
                resumeViewUrl = uploaded.viewUrl;
                setCandidateResumeUrl(uploaded.storageUrl);
                setCandidateResumeViewUrl(uploaded.viewUrl);
                setCandidateResumeFile(null);
            }

            if (!resumeUrl) {
                throw new Error("Resume is required.");
            }

            const interests = normalizeCommaSeparated(candidateInterests);
            if (interests.length === 0) {
                throw new Error("At least one interest is required.");
            }

            await onSubmit({
                timezone: normalizeTimezone(timezone),
                resumeUrl,
                interests,
                experience: serializeExperienceEntries(experienceEntries, "Experience"),
                activities: serializeExperienceEntries(activityEntries, "Activity"),
                education: serializeEducationEntries(educationEntries),
            });

            setCandidateResumeViewUrl(resumeViewUrl || resumeUrl);
        } catch (submitError) {
            if (submitError instanceof Error) {
                setError(submitError.message);
            } else {
                setError("Unable to save candidate profile.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const effectiveDisabled = disabled || isSaving;

    return (
        <form className="space-y-8" onSubmit={handleSubmit}>
            {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            <section className="space-y-4 rounded-md border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Account basics</h2>

                <div>
                    <label htmlFor="candidate-timezone" className="block text-sm font-medium mb-1">
                        Timezone
                    </label>
                    <select
                        id="candidate-timezone"
                        required
                        disabled={effectiveDisabled}
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                        className="w-full p-2 border rounded-md"
                    >
                        {SUPPORTED_TIMEZONES.map((timezoneOption) => (
                            <option key={timezoneOption} value={timezoneOption}>
                                {timezoneOption}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="rounded-md border border-gray-300 p-4 space-y-2">
                    <label htmlFor={`candidate-resume-${mode}`} className="block text-sm font-medium text-gray-700">
                        Resume (PDF)
                    </label>
                    {candidateResumeViewUrl ? (
                        <div className="text-xs text-gray-600 space-y-1">
                            <p>A resume is already on file. Upload another PDF only if you want to replace it.</p>
                            <a
                                href={candidateResumeViewUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline"
                            >
                                Open uploaded resume
                            </a>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">Upload a PDF resume to continue.</p>
                    )}

                    <input
                        id={`candidate-resume-${mode}`}
                        type="file"
                        accept=".pdf,application/pdf"
                        disabled={effectiveDisabled}
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
                    <label htmlFor={`candidate-interests-${mode}`} className="block text-sm font-medium mb-1">
                        Interests (comma separated)
                    </label>
                    <input
                        id={`candidate-interests-${mode}`}
                        required
                        disabled={effectiveDisabled}
                        type="text"
                        value={candidateInterests}
                        onChange={(event) => setCandidateInterests(event.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="Interview Prep, Networking, Career Advice"
                    />
                </div>
            </section>

            <TimelineEntriesEditor
                sectionTitle="Experience"
                sectionDescription="Add one or more experience entries."
                addLabel="Add experience"
                entryLabelPrefix="Experience"
                titlePlaceholder="Title"
                companyPlaceholder="Company"
                currentLabel="Current role"
                entries={experienceEntries}
                setEntries={setExperienceEntries}
                disabled={effectiveDisabled}
            />

            <TimelineEntriesEditor
                sectionTitle="Activities"
                sectionDescription="Add one or more activity entries."
                addLabel="Add activity"
                entryLabelPrefix="Activity"
                titlePlaceholder="Role / activity title"
                companyPlaceholder="Organization"
                currentLabel="Ongoing activity"
                entries={activityEntries}
                setEntries={setActivityEntries}
                disabled={effectiveDisabled}
            />

            <EducationEntriesEditor
                entries={educationEntries}
                setEntries={setEducationEntries}
                disabled={effectiveDisabled}
            />

            {footerContent}

            <button
                type="submit"
                disabled={effectiveDisabled}
                className="w-full rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
            >
                {isSaving ? submittingLabel : submitLabel}
            </button>
        </form>
    );
}
