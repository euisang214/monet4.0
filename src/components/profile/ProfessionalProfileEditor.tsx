"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfessionalProfileFields } from "@/components/profile/ProfessionalProfileFields";
import { TimelineEntriesEditor } from "@/components/profile/shared/TimelineEntriesEditor";
import { EducationEntriesEditor } from "@/components/profile/shared/EducationEntriesEditor";
import { SUPPORTED_TIMEZONES, normalizeTimezone } from "@/lib/utils/supported-timezones";
import { useTrackedRequest } from "@/components/ui/providers/RequestToastProvider";
import { executeTrackedAction } from "@/components/ui/actions/executeTrackedAction";
import { buildErrorToastCopy, type ToastCopy } from "@/components/ui/hooks/requestToastController";
import {
    Button,
    Field,
    FormSection,
    InlineNotice,
    SelectInput,
    TextInput,
} from "@/components/ui";
import {
    EducationEntry,
    ensureExactlyOneCurrentExperience,
    mapEducationEntries,
    mapTimelineEntries,
    normalizeCommaSeparated,
    serializeEducationEntries,
    serializeExperienceEntries,
    TimelineEntry,
    type SerializedEducationEntry,
    type SerializedTimelineEntry,
} from "@/components/profile/shared/profileFormAdapters";

type ProfessionalProfileEditorMode = "onboarding" | "settings";

export type ProfessionalProfileEditorInitialData = {
    firstName?: string | null;
    lastName?: string | null;
    timezone?: string | null;
    bio?: string | null;
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
    asyncStatus?: {
        pending: ToastCopy;
        success: ToastCopy;
        error?: ToastCopy | ((error: unknown) => ToastCopy);
        errorTitle?: string;
        errorMessage?: string;
        navigation?: {
            href: string;
            mode?: "push" | "replace";
        };
    };
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
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const trackedRuntime = {
        runTrackedRequest,
        push: router.push,
        replace: router.replace,
        refresh: router.refresh,
    };
    const [firstName, setFirstName] = useState(initialData?.firstName || "");
    const [lastName, setLastName] = useState(initialData?.lastName || "");
    const [timezone, setTimezone] = useState(normalizeTimezone(initialData?.timezone));
    const [bio, setBio] = useState(initialData?.bio || "");
    const [price, setPrice] = useState(
        typeof initialData?.price === "number" ? initialData.price.toString() : ""
    );
    const [corporateEmail, setCorporateEmail] = useState(initialData?.corporateEmail || "");
    const [interests, setInterests] = useState(initialData?.interests?.join(", ") || "");
    const [experienceEntries, setExperienceEntries] = useState(
        mapTimelineEntries(initialData?.experience, { enforceSingleCurrent: true })
    );
    const [activityEntries, setActivityEntries] = useState(mapTimelineEntries(initialData?.activities));
    const [educationEntries, setEducationEntries] = useState(mapEducationEntries(initialData?.education));
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isConnectingStripe, setIsConnectingStripe] = useState(false);

    useEffect(() => {
        setFirstName(initialData?.firstName || "");
        setLastName(initialData?.lastName || "");
        setTimezone(normalizeTimezone(initialData?.timezone));
        setBio(initialData?.bio || "");
        setPrice(typeof initialData?.price === "number" ? initialData.price.toString() : "");
        const nextCorporateEmail = initialData?.corporateEmail || "";
        setCorporateEmail(nextCorporateEmail);
        onCorporateEmailDraftChange?.(nextCorporateEmail);
        setInterests(initialData?.interests?.join(", ") || "");
        setExperienceEntries(mapTimelineEntries(initialData?.experience, { enforceSingleCurrent: true }));
        setActivityEntries(mapTimelineEntries(initialData?.activities));
        setEducationEntries(mapEducationEntries(initialData?.education));
    }, [initialData, onCorporateEmailDraftChange]);

    const payoutReady = isPayoutReady(stripeStatus);
    const effectiveCorporateEmail =
        mode === "settings" && typeof corporateEmailOverride === "string"
            ? corporateEmailOverride
            : corporateEmail;

    const handleCorporateEmailChange = (value: string) => {
        setCorporateEmail(value);
        onCorporateEmailDraftChange?.(value);
    };

    const handleConnectStripe = async () => {
        if (!onConnectStripe || isConnectingStripe) return;

        setError("");
        setIsConnectingStripe(true);
        try {
            await onConnectStripe();
        } catch (connectError) {
            if (connectError instanceof Error) {
                setError(connectError.message);
            } else {
                setError("Unable to initiate Stripe onboarding.");
            }
        } finally {
            setIsConnectingStripe(false);
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            if (requirePayoutReady && !payoutReady) {
                throw new Error("Connect Stripe payouts before completing onboarding.");
            }

            if (!ensureExactlyOneCurrentExperience(experienceEntries)) {
                throw new Error("Select exactly one current role in your experience.");
            }

            const trimmedFirstName = firstName.trim();
            if (!trimmedFirstName) {
                throw new Error("First name is required.");
            }

            const trimmedLastName = lastName.trim();
            if (!trimmedLastName) {
                throw new Error("Last name is required.");
            }

            const parsedPrice = Number.parseFloat(price);
            if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                throw new Error("Enter a valid hourly rate greater than zero.");
            }

            const normalizedInterests = normalizeCommaSeparated(interests);
            if (normalizedInterests.length === 0) {
                throw new Error("At least one interest is required.");
            }

            const trimmedBio = bio.trim();
            if (!trimmedBio) {
                throw new Error("Bio is required.");
            }

            const trimmedCorporateEmail = effectiveCorporateEmail.trim();
            if (!trimmedCorporateEmail) {
                throw new Error("Corporate email is required.");
            }
            if (requireCorporateVerification && !isCorporateEmailVerified) {
                throw new Error(corporateVerificationMessage);
            }

            const submitAsync = () =>
                onSubmit({
                    firstName: trimmedFirstName,
                    lastName: trimmedLastName,
                    timezone: normalizeTimezone(timezone),
                    bio: trimmedBio,
                    price: parsedPrice,
                    corporateEmail: trimmedCorporateEmail,
                    interests: normalizedInterests,
                    experience: serializeExperienceEntries(experienceEntries, "Experience"),
                    activities: serializeExperienceEntries(activityEntries, "Activity"),
                    education: serializeEducationEntries(educationEntries),
                });

            if (asyncStatus) {
                const navigation = asyncStatus.navigation;
                try {
                    await executeTrackedAction(trackedRuntime, {
                        action: submitAsync,
                        copy: {
                            pending: asyncStatus.pending,
                            success: asyncStatus.success,
                            error: asyncStatus.error || ((submitError) => buildErrorToastCopy(
                                submitError,
                                asyncStatus.errorTitle || "Profile save failed",
                                asyncStatus.errorMessage,
                            )),
                        },
                        postSuccess: navigation
                            ? {
                                  kind: navigation.mode === "replace" ? "replace" : "push",
                                  href: navigation.href,
                              }
                            : { kind: "none" },
                    });
                } catch {
                    // Async failures are surfaced via tracked toast.
                }
            } else {
                await submitAsync();
            }
        } catch (submitError) {
            if (submitError instanceof Error) {
                setError(submitError.message);
            } else {
                setError("Unable to save professional profile.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const effectiveDisabled = disabled || isSaving;

    return (
        <form className="space-y-8" onSubmit={handleSubmit}>
            {error ? (
                <InlineNotice tone="error" title="Profile issue">
                    {error}
                </InlineNotice>
            ) : null}

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
                <div className="grid gap-4 md:grid-cols-2">
                    <Field label="First name" htmlFor={`professional-first-name-${mode}`}>
                        <TextInput
                            id={`professional-first-name-${mode}`}
                            required
                            disabled={effectiveDisabled}
                            type="text"
                            value={firstName}
                            onChange={(event) => setFirstName(event.target.value)}
                            placeholder="First name"
                        />
                    </Field>

                    <Field label="Last name" htmlFor={`professional-last-name-${mode}`}>
                        <TextInput
                            id={`professional-last-name-${mode}`}
                            required
                            disabled={effectiveDisabled}
                            type="text"
                            value={lastName}
                            onChange={(event) => setLastName(event.target.value)}
                            placeholder="Last name"
                        />
                    </Field>
                </div>

                <Field label="Timezone" htmlFor={`professional-timezone-${mode}`}>
                    <SelectInput
                        id={`professional-timezone-${mode}`}
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

                <ProfessionalProfileFields
                    bio={bio}
                    onBioChange={setBio}
                    price={price}
                    onPriceChange={setPrice}
                    corporateEmail={corporateEmail}
                    onCorporateEmailChange={handleCorporateEmailChange}
                    showCorporateEmail={mode !== "settings"}
                    interests={interests}
                    onInterestsChange={setInterests}
                    disabled={effectiveDisabled}
                />
            </FormSection>

            <TimelineEntriesEditor
                sectionTitle="Experience"
                sectionDescription="Add one or more experience entries. Select exactly one current role."
                addLabel="Add experience"
                entryLabelPrefix="Experience"
                titlePlaceholder="Title"
                companyPlaceholder="Company"
                currentLabel="Current role"
                entries={experienceEntries}
                setEntries={setExperienceEntries}
                enforceSingleCurrent
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

            <Button
                type="submit"
                disabled={
                    effectiveDisabled ||
                    (requirePayoutReady && !payoutReady) ||
                    (requireCorporateVerification && !isCorporateEmailVerified)
                }
                className="w-full"
                size="lg"
                loading={isSaving}
                loadingLabel={submittingLabel}
            >
                {submitLabel}
            </Button>
            {requireCorporateVerification && !isCorporateEmailVerified ? (
                <InlineNotice tone="warning" title="Verification required">
                    {corporateVerificationMessage}
                </InlineNotice>
            ) : null}
        </form>
    );
}
