"use client";

import { ReactNode, useEffect, useState } from "react";
import { TimelineEntriesEditor } from "@/components/profile/shared/TimelineEntriesEditor";
import { EducationEntriesEditor } from "@/components/profile/shared/EducationEntriesEditor";
import { appRoutes } from "@/lib/shared/routes";
import { SUPPORTED_TIMEZONES, normalizeTimezone } from "@/lib/utils/supported-timezones";
import {
    Button,
    Field,
    FileInput,
    FormSection,
    InlineNotice,
    SelectInput,
    TextInput,
} from "@/components/ui";
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
    firstName?: string | null;
    lastName?: string | null;
    timezone?: string | null;
    resumeUrl?: string | null;
    resumeViewUrl?: string | null;
    interests?: string[] | null;
    experience?: TimelineEntry[] | null;
    activities?: TimelineEntry[] | null;
    education?: EducationEntry[] | null;
};

export type CandidateProfileSubmitPayload = {
    firstName: string;
    lastName: string;
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

    const response = await fetch(appRoutes.api.candidate.uploadResume, {
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
    const [firstName, setFirstName] = useState(initialData?.firstName || "");
    const [lastName, setLastName] = useState(initialData?.lastName || "");
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
        setFirstName(initialData?.firstName || "");
        setLastName(initialData?.lastName || "");
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

            const trimmedFirstName = firstName.trim();
            if (!trimmedFirstName) {
                throw new Error("First name is required.");
            }

            const trimmedLastName = lastName.trim();
            if (!trimmedLastName) {
                throw new Error("Last name is required.");
            }

            const interests = normalizeCommaSeparated(candidateInterests);
            if (interests.length === 0) {
                throw new Error("At least one interest is required.");
            }

            await onSubmit({
                firstName: trimmedFirstName,
                lastName: trimmedLastName,
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
    const resumeHint = candidateResumeViewUrl ? (
        <>
            A resume is already on file. Upload another PDF only if you want to replace it.{" "}
            <a href={candidateResumeViewUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Open uploaded resume
            </a>
        </>
    ) : (
        "Upload a PDF resume to continue."
    );

    return (
        <form className="space-y-8" onSubmit={handleSubmit}>
            {error ? (
                <InlineNotice tone="error" title="Profile issue">
                    {error}
                </InlineNotice>
            ) : null}

            <FormSection
                title="Account basics"
                description="Core details professionals will see before they ever open your resume."
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First name" htmlFor={`candidate-first-name-${mode}`}>
                        <TextInput
                            id={`candidate-first-name-${mode}`}
                            required
                            disabled={effectiveDisabled}
                            type="text"
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                            placeholder="First name"
                        />
                    </Field>
                    <Field label="Last name" htmlFor={`candidate-last-name-${mode}`}>
                        <TextInput
                            id={`candidate-last-name-${mode}`}
                            required
                            disabled={effectiveDisabled}
                            type="text"
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                            placeholder="Last name"
                        />
                    </Field>
                </div>

                <Field label="Timezone" htmlFor="candidate-timezone">
                    <SelectInput
                        id="candidate-timezone"
                        required
                        disabled={effectiveDisabled}
                        value={timezone}
                        onChange={(event) => setTimezone(event.target.value)}
                    >
                        {SUPPORTED_TIMEZONES.map((timezoneOption) => (
                            <option key={timezoneOption} value={timezoneOption}>
                                {timezoneOption}
                            </option>
                        ))}
                    </SelectInput>
                </Field>

                <Field label="Resume (PDF)" htmlFor={`candidate-resume-${mode}`} hint={resumeHint}>
                    <FileInput
                        id={`candidate-resume-${mode}`}
                        type="file"
                        accept=".pdf,application/pdf"
                        disabled={effectiveDisabled}
                        onChange={(event) => setCandidateResumeFile(event.target.files?.[0] ?? null)}
                    />

                    {candidateResumeFile ? (
                        <p className="text-xs text-gray-500">Selected file: {candidateResumeFile.name}</p>
                    ) : null}
                </Field>

                <Field
                    label="Interests (comma separated)"
                    htmlFor={`candidate-interests-${mode}`}
                    hint="Use specific interests and goals so professionals can tailor sessions."
                >
                    <TextInput
                        id={`candidate-interests-${mode}`}
                        required
                        disabled={effectiveDisabled}
                        type="text"
                        value={candidateInterests}
                        onChange={(event) => setCandidateInterests(event.target.value)}
                        placeholder="Poker, Tennis, Reading"
                    />
                </Field>
            </FormSection>

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

            <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isSaving}
                loadingLabel={submittingLabel}
                disabled={effectiveDisabled}
            >
                {submitLabel}
            </Button>
        </form>
    );
}
