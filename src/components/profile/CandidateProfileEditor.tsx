"use client";

import { ReactNode, useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldErrors } from "react-hook-form";
import { TimelineEntriesEditor } from "@/components/profile/shared/TimelineEntriesEditor";
import { EducationEntriesEditor } from "@/components/profile/shared/EducationEntriesEditor";
import { appRoutes } from "@/lib/shared/routes";
import { normalizeTimezone } from "@/lib/utils/supported-timezones";
import {
    Field,
    FileInput,
    FormSection,
    TextInput,
} from "@/components/ui";
import {
    normalizeCommaSeparated,
    serializeEducationEntries,
    serializeExperienceEntries,
    type EducationEntry,
    type SerializedEducationEntry,
    type SerializedTimelineEntry,
    type TimelineEntry,
} from "@/components/profile/shared/profileFormAdapters";
import {
    type CandidateProfileFormInput,
    candidateProfileFormSchema,
    getCandidateProfileDefaultValues,
    getProfileFormErrorMessage,
    type CandidateProfileFormValues,
} from "@/components/profile/shared/profileEditorSchemas";
import {
    useTrackedProfileSubmit,
    type ProfileAsyncStatus,
} from "@/components/profile/shared/useTrackedProfileSubmit";
import { ProfileBasicsFields } from "@/components/profile/shared/ProfileBasicsFields";
import { ProfileFormNotice } from "@/components/profile/shared/ProfileFormNotice";
import { ProfileSubmitButton } from "@/components/profile/shared/ProfileSubmitButton";

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
    asyncStatus?: ProfileAsyncStatus<{ resumeUrl: string; resumeViewUrl: string }>;
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
    asyncStatus,
}: CandidateProfileEditorProps) {
    const runTrackedProfileSubmit = useTrackedProfileSubmit();
    const form = useForm<CandidateProfileFormInput, undefined, CandidateProfileFormValues>({
        resolver: zodResolver(candidateProfileFormSchema),
        defaultValues: getCandidateProfileDefaultValues(initialData),
    });
    const [candidateResumeFile, setCandidateResumeFile] = useState<File | null>(null);
    const [candidateResumeViewUrl, setCandidateResumeViewUrl] = useState(
        initialData?.resumeViewUrl || initialData?.resumeUrl || "",
    );
    const [submissionError, setSubmissionError] = useState<string | null>(null);

    useEffect(() => {
        form.reset(getCandidateProfileDefaultValues(initialData));
        setCandidateResumeFile(null);
        setCandidateResumeViewUrl(initialData?.resumeViewUrl || initialData?.resumeUrl || "");
        setSubmissionError(null);
    }, [form, initialData]);

    const timezone = form.watch("timezone");
    const currentValues = form.getValues();
    const effectiveDisabled = disabled || form.formState.isSubmitting;
    const errorMessage = submissionError || getProfileFormErrorMessage(form.formState.errors);
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

    const handleValidSubmit = async (values: CandidateProfileFormValues) => {
        setSubmissionError(null);

        try {
            if (!values.resumeUrl.trim() && !candidateResumeFile) {
                throw new Error("Resume is required.");
            }

            if (candidateResumeFile && candidateResumeFile.size > MAX_RESUME_SIZE_BYTES) {
                throw new Error("Resume must be 4MB or smaller.");
            }

            if (candidateResumeFile) {
                const isPdf =
                    candidateResumeFile.type === PDF_CONTENT_TYPE
                    || candidateResumeFile.name.toLowerCase().endsWith(".pdf");
                if (!isPdf) {
                    throw new Error("Resume must be a PDF.");
                }
            }

            const submitAction = async () => {
                let resumeUrl = values.resumeUrl.trim();
                let resumeViewUrl = candidateResumeViewUrl || resumeUrl;

                if (candidateResumeFile) {
                    const uploaded = await uploadCandidateResume(candidateResumeFile);
                    resumeUrl = uploaded.storageUrl;
                    resumeViewUrl = uploaded.viewUrl;
                    form.setValue("resumeUrl", uploaded.storageUrl, { shouldDirty: true });
                    setCandidateResumeViewUrl(uploaded.viewUrl);
                    setCandidateResumeFile(null);
                }

                await onSubmit({
                    firstName: values.firstName.trim(),
                    lastName: values.lastName.trim(),
                    timezone: normalizeTimezone(values.timezone),
                    resumeUrl,
                    interests: normalizeCommaSeparated(values.interestsText),
                    experience: serializeExperienceEntries(values.experience, "Experience"),
                    activities: serializeExperienceEntries(values.activities, "Activity"),
                    education: serializeEducationEntries(values.education),
                });

                return {
                    resumeUrl,
                    resumeViewUrl: resumeViewUrl || resumeUrl,
                };
            };

            const result = await runTrackedProfileSubmit(submitAction, asyncStatus);
            if (result) {
                setCandidateResumeViewUrl(result.resumeViewUrl);
            }
        } catch (submitError) {
            if (submitError instanceof Error) {
                setSubmissionError(submitError.message);
            } else {
                setSubmissionError("Unable to save candidate profile.");
            }
        }
    };

    const handleInvalidSubmit = (errors: FieldErrors<CandidateProfileFormInput>) => {
        setSubmissionError(getProfileFormErrorMessage(errors) || "Unable to save candidate profile.");
    };

    return (
        <form className="space-y-8" onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)}>
            <input type="hidden" {...form.register("resumeUrl")} />
            <input type="hidden" value={timezone} {...form.register("timezone")} />

            <ProfileFormNotice errorMessage={errorMessage} />

            <FormSection
                title="Account basics"
                description="Core details professionals will see before they ever open your resume."
            >
                <ProfileBasicsFields
                    mode={mode}
                    prefix="candidate"
                    timezoneId="candidate-timezone"
                    register={form.register}
                    setValue={form.setValue}
                    errors={form.formState.errors}
                    defaults={{
                        firstName: currentValues.firstName,
                        lastName: currentValues.lastName,
                        timezone: currentValues.timezone,
                    }}
                    timezone={timezone}
                    disabled={effectiveDisabled}
                />

                <Field label="Resume (PDF)" htmlFor={`candidate-resume-${mode}`} hint={resumeHint}>
                    <FileInput
                        id={`candidate-resume-${mode}`}
                        type="file"
                        accept=".pdf,application/pdf"
                        disabled={effectiveDisabled}
                        onChange={(event) => {
                            setCandidateResumeFile(event.target.files?.[0] ?? null);
                            setSubmissionError(null);
                        }}
                    />

                    {candidateResumeFile ? (
                        <p className="text-xs text-gray-500">Selected file: {candidateResumeFile.name}</p>
                    ) : null}
                </Field>

                <Field
                    label="Interests (comma separated)"
                    htmlFor={`candidate-interests-${mode}`}
                    hint="Use specific interests and goals so professionals can tailor sessions."
                    error={form.formState.errors.interestsText?.message}
                >
                    <TextInput
                        id={`candidate-interests-${mode}`}
                        required
                        disabled={effectiveDisabled}
                        invalid={Boolean(form.formState.errors.interestsText)}
                        type="text"
                        defaultValue={currentValues.interestsText}
                        placeholder="Poker, Tennis, Reading"
                        {...form.register("interestsText")}
                    />
                </Field>
            </FormSection>

            <TimelineEntriesEditor
                name="experience"
                sectionTitle="Experience"
                sectionDescription="Add one or more experience entries."
                addLabel="Add experience"
                entryLabelPrefix="Experience"
                titlePlaceholder="Title"
                companyPlaceholder="Company"
                currentLabel="Current role"
                control={form.control}
                register={form.register}
                setValue={form.setValue}
                errors={form.formState.errors}
                disabled={effectiveDisabled}
            />

            <TimelineEntriesEditor
                name="activities"
                sectionTitle="Activities"
                sectionDescription="Add one or more activity entries."
                addLabel="Add activity"
                entryLabelPrefix="Activity"
                titlePlaceholder="Role / activity title"
                companyPlaceholder="Organization"
                currentLabel="Ongoing activity"
                control={form.control}
                register={form.register}
                setValue={form.setValue}
                errors={form.formState.errors}
                disabled={effectiveDisabled}
            />

            <EducationEntriesEditor
                control={form.control}
                register={form.register}
                setValue={form.setValue}
                errors={form.formState.errors}
                disabled={effectiveDisabled}
            />

            {footerContent}

            <ProfileSubmitButton
                submitLabel={submitLabel}
                submittingLabel={submittingLabel}
                disabled={effectiveDisabled}
                loading={form.formState.isSubmitting}
            />
        </form>
    );
}
