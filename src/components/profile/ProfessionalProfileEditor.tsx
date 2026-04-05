"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldErrors } from "react-hook-form";
import { ProfessionalProfileFields } from "@/components/profile/ProfessionalProfileFields";
import { TimelineEntriesEditor } from "@/components/profile/shared/TimelineEntriesEditor";
import { EducationEntriesEditor } from "@/components/profile/shared/EducationEntriesEditor";
import { normalizeTimezone } from "@/lib/utils/supported-timezones";
import {
    Button,
    FormSection,
    InlineNotice,
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
    getProfessionalProfileDefaultValues,
    getProfileFormErrorMessage,
    professionalProfileFormSchema,
    type ProfessionalProfileFormInput,
    type ProfessionalProfileFormValues,
} from "@/components/profile/shared/profileEditorSchemas";
import {
    useTrackedProfileSubmit,
    type ProfileAsyncStatus,
} from "@/components/profile/shared/useTrackedProfileSubmit";
import { ProfileBasicsFields } from "@/components/profile/shared/ProfileBasicsFields";
import { ProfileFormNotice } from "@/components/profile/shared/ProfileFormNotice";
import { ProfileSubmitButton } from "@/components/profile/shared/ProfileSubmitButton";
import { type ProfessionalIndustryValue } from "@/lib/shared/professional-industries";
import { type ProfessionalSeniorityValue } from "@/lib/shared/professional-seniority";

type ProfessionalProfileEditorMode = "onboarding" | "settings";

export type ProfessionalProfileEditorInitialData = {
    firstName?: string | null;
    lastName?: string | null;
    timezone?: string | null;
    bio?: string | null;
    industry?: string | null;
    seniority?: string | null;
    price?: number | null;
    corporateEmail?: string | null;
    verifiedAt?: string | null;
    interests?: string[] | null;
    experience?: TimelineEntry[] | null;
    activities?: TimelineEntry[] | null;
    education?: EducationEntry[] | null;
    title?: string | null;
    employer?: string | null;
};

export type ProfessionalProfileSubmitPayload = {
    firstName: string;
    lastName: string;
    timezone: string;
    bio: string;
    industry: ProfessionalIndustryValue;
    seniority: ProfessionalSeniorityValue;
    price: number;
    corporateEmail: string;
    interests: string[];
    experience: SerializedTimelineEntry[];
    activities: SerializedTimelineEntry[];
    education: SerializedEducationEntry[];
};

export type ProfessionalStripeStatus = {
    accountId: string | null;
    payoutsEnabled?: boolean;
    chargesEnabled?: boolean;
    detailsSubmitted?: boolean;
};

type ProfessionalProfileEditorProps = {
    mode: ProfessionalProfileEditorMode;
    initialData?: ProfessionalProfileEditorInitialData;
    onSubmit: (payload: ProfessionalProfileSubmitPayload) => Promise<void>;
    submitLabel: string;
    submittingLabel?: string;
    disabled?: boolean;
    requirePayoutReady?: boolean;
    stripeStatus?: ProfessionalStripeStatus | null;
    onConnectStripe?: () => Promise<void>;
    onCorporateEmailDraftChange?: (value: string) => void;
    corporateEmailOverride?: string;
    requireCorporateVerification?: boolean;
    isCorporateEmailVerified?: boolean;
    corporateVerificationMessage?: string;
    asyncStatus?: ProfileAsyncStatus<void>;
};

function isPayoutReady(status?: ProfessionalStripeStatus | null) {
    return Boolean(status?.accountId) && status?.payoutsEnabled === true;
}

export function ProfessionalProfileEditor({
    mode,
    initialData,
    onSubmit,
    submitLabel,
    submittingLabel = "Saving...",
    disabled = false,
    requirePayoutReady = false,
    stripeStatus,
    onConnectStripe,
    onCorporateEmailDraftChange,
    corporateEmailOverride,
    requireCorporateVerification = false,
    isCorporateEmailVerified = true,
    corporateVerificationMessage = "Verify your corporate email to complete onboarding.",
    asyncStatus,
}: ProfessionalProfileEditorProps) {
    const runTrackedProfileSubmit = useTrackedProfileSubmit();
    const form = useForm<ProfessionalProfileFormInput, unknown, ProfessionalProfileFormValues>({
        resolver: zodResolver(professionalProfileFormSchema),
        defaultValues: getProfessionalProfileDefaultValues(initialData),
    });
    const [submissionError, setSubmissionError] = useState<string | null>(null);
    const [isConnectingStripe, setIsConnectingStripe] = useState(false);

    useEffect(() => {
        form.reset(getProfessionalProfileDefaultValues(initialData));
        onCorporateEmailDraftChange?.(initialData?.corporateEmail || "");
        setSubmissionError(null);
    }, [form, initialData, onCorporateEmailDraftChange]);

    const payoutReady = isPayoutReady(stripeStatus);
    const timezone = form.watch("timezone");
    const currentValues = form.getValues();
    const effectiveDisabled = disabled || form.formState.isSubmitting;
    const errorMessage = submissionError || getProfileFormErrorMessage(form.formState.errors);

    const handleConnectStripe = async () => {
        if (!onConnectStripe || isConnectingStripe) return;

        setSubmissionError(null);
        setIsConnectingStripe(true);
        try {
            await onConnectStripe();
        } catch (connectError) {
            if (connectError instanceof Error) {
                setSubmissionError(connectError.message);
            } else {
                setSubmissionError("Unable to initiate Stripe onboarding.");
            }
        } finally {
            setIsConnectingStripe(false);
        }
    };

    const handleValidSubmit = async (values: ProfessionalProfileFormValues) => {
        setSubmissionError(null);

        try {
            if (requirePayoutReady && !payoutReady) {
                throw new Error("Connect Stripe payouts before completing onboarding.");
            }

            const effectiveCorporateEmail = (
                mode === "settings" && typeof corporateEmailOverride === "string"
                    ? corporateEmailOverride
                    : values.corporateEmail
            ).trim();

            if (!effectiveCorporateEmail) {
                throw new Error("Corporate email is required.");
            }

            if (requireCorporateVerification && !isCorporateEmailVerified) {
                throw new Error(corporateVerificationMessage);
            }

            await runTrackedProfileSubmit(
                () => onSubmit({
                    firstName: values.firstName.trim(),
                    lastName: values.lastName.trim(),
                    timezone: normalizeTimezone(values.timezone),
                    bio: values.bio.trim(),
                    industry: values.industry as ProfessionalIndustryValue,
                    seniority: values.seniority as ProfessionalSeniorityValue,
                    price: Number.parseFloat(values.price),
                    corporateEmail: effectiveCorporateEmail,
                    interests: normalizeCommaSeparated(values.interestsText),
                    experience: serializeExperienceEntries(values.experience, "Experience"),
                    activities: serializeExperienceEntries(values.activities, "Activity"),
                    education: serializeEducationEntries(values.education),
                }),
                asyncStatus,
            );
        } catch (submitError) {
            if (submitError instanceof Error) {
                setSubmissionError(submitError.message);
            } else {
                setSubmissionError("Unable to save professional profile.");
            }
        }
    };

    const handleInvalidSubmit = (errors: FieldErrors<ProfessionalProfileFormValues>) => {
        setSubmissionError(getProfileFormErrorMessage(errors) || "Unable to save professional profile.");
    };

    return (
        <form className="space-y-8" onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)}>
            <input type="hidden" value={timezone} {...form.register("timezone")} />
            <ProfileFormNotice errorMessage={errorMessage} />

            {initialData?.title || initialData?.employer ? (
                <InlineNotice tone="info" title="Current role">
                    {initialData?.title || "Unknown title"}
                    {initialData?.employer ? ` at ${initialData.employer}` : ""}
                </InlineNotice>
            ) : null}

            {requirePayoutReady ? (
                <FormSection
                title="Stripe payouts"
                description="Connect Stripe and enable payouts before completing professional onboarding."
                tone="muted"
                actions={
                        <Button
                            type="button"
                            disabled={effectiveDisabled || isConnectingStripe}
                            onClick={handleConnectStripe}
                            loading={isConnectingStripe}
                            loadingLabel="Redirecting..."
                        >
                            {stripeStatus?.accountId ? "Manage Stripe Connection" : "Connect Stripe for Payouts"}
                        </Button>
                    }
                >
                    <InlineNotice tone={payoutReady ? "success" : "warning"} title="Payout status">
                        {payoutReady
                            ? "Stripe payouts are enabled."
                            : "Stripe payouts are not enabled yet."}
                    </InlineNotice>
                </FormSection>
            ) : null}

            <FormSection
                title="Account basics"
                description="This is the foundation candidates will use to evaluate credibility and fit."
            >
                <ProfileBasicsFields
                    mode={mode}
                    prefix="professional"
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

                {mode === "settings" ? <input type="hidden" {...form.register("corporateEmail")} /> : null}

                <ProfessionalProfileFields
                    register={form.register}
                    errors={form.formState.errors}
                    defaults={{
                        bio: currentValues.bio,
                        industry: currentValues.industry,
                        seniority: currentValues.seniority,
                        price: currentValues.price,
                        corporateEmail: currentValues.corporateEmail,
                        interestsText: currentValues.interestsText,
                    }}
                    onCorporateEmailChange={onCorporateEmailDraftChange}
                    showCorporateEmail={mode !== "settings"}
                    disabled={effectiveDisabled}
                />
            </FormSection>

            <TimelineEntriesEditor
                name="experience"
                sectionTitle="Experience"
                sectionDescription="Add one or more experience entries. Select exactly one current role."
                addLabel="Add experience"
                entryLabelPrefix="Experience"
                titlePlaceholder="Title"
                companyPlaceholder="Company"
                currentLabel="Current role"
                control={form.control}
                register={form.register}
                setValue={form.setValue}
                errors={form.formState.errors}
                enforceSingleCurrent
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

            <ProfileSubmitButton
                submitLabel={submitLabel}
                submittingLabel={submittingLabel}
                disabled={
                    effectiveDisabled
                    || (requirePayoutReady && !payoutReady)
                    || (requireCorporateVerification && !isCorporateEmailVerified)
                }
                loading={form.formState.isSubmitting}
            />

            {requireCorporateVerification && !isCorporateEmailVerified ? (
                <InlineNotice tone="warning" title="Verification required">
                    {corporateVerificationMessage}
                </InlineNotice>
            ) : null}
        </form>
    );
}
