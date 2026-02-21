"use client";

import { useEffect, useState } from "react";
import { ProfessionalProfileFields } from "@/components/profile/ProfessionalProfileFields";
import { TimelineEntriesEditor } from "@/components/profile/shared/TimelineEntriesEditor";
import { EducationEntriesEditor } from "@/components/profile/shared/EducationEntriesEditor";
import { SUPPORTED_TIMEZONES, normalizeTimezone } from "@/lib/utils/supported-timezones";
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
}: ProfessionalProfileEditorProps) {
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

            const trimmedCorporateEmail = corporateEmail.trim();
            if (!trimmedCorporateEmail) {
                throw new Error("Corporate email is required.");
            }

            await onSubmit({
                timezone: normalizeTimezone(timezone),
                bio: trimmedBio,
                price: parsedPrice,
                corporateEmail: trimmedCorporateEmail,
                interests: normalizedInterests,
                experience: serializeExperienceEntries(experienceEntries, "Experience"),
                activities: serializeExperienceEntries(activityEntries, "Activity"),
                education: serializeEducationEntries(educationEntries),
            });
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
            {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

            {initialData?.title || initialData?.employer ? (
                <p className="text-sm text-gray-600">
                    Current role: {initialData?.title || "Unknown title"}
                    {initialData?.employer ? ` at ${initialData.employer}` : ""}
                </p>
            ) : null}

            {requirePayoutReady ? (
                <section className="space-y-3 rounded-md border border-gray-200 p-4 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-900">Stripe payouts</h2>
                    <p className="text-sm text-gray-600">
                        Connect Stripe and enable payouts before completing professional onboarding.
                    </p>
                    <p className={`text-sm font-medium ${payoutReady ? "text-green-700" : "text-gray-700"}`}>
                        {payoutReady
                            ? "Stripe payouts are enabled."
                            : "Stripe payouts are not enabled yet."}
                    </p>
                    <button
                        type="button"
                        disabled={effectiveDisabled || isConnectingStripe}
                        onClick={handleConnectStripe}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {isConnectingStripe
                            ? "Redirecting..."
                            : stripeStatus?.accountId
                              ? "Manage Stripe Connection"
                              : "Connect Stripe for Payouts"}
                    </button>
                </section>
            ) : null}

            <section className="space-y-4 rounded-md border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900">Account basics</h2>

                <div>
                    <label htmlFor={`professional-timezone-${mode}`} className="block text-sm font-medium mb-1">
                        Timezone
                    </label>
                    <select
                        id={`professional-timezone-${mode}`}
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

                <ProfessionalProfileFields
                    bio={bio}
                    onBioChange={setBio}
                    price={price}
                    onPriceChange={setPrice}
                    corporateEmail={corporateEmail}
                    onCorporateEmailChange={handleCorporateEmailChange}
                    interests={interests}
                    onInterestsChange={setInterests}
                    disabled={effectiveDisabled}
                />
            </section>

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

            <button
                type="submit"
                disabled={effectiveDisabled || (requirePayoutReady && !payoutReady)}
                className="w-full rounded-md border border-transparent bg-black py-2 px-4 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
            >
                {isSaving ? submittingLabel : submitLabel}
            </button>
        </form>
    );
}
