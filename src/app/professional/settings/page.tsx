"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useNotification } from "@/components/ui/hooks/useNotification";
import { NotificationBanner } from "@/components/ui/composites/NotificationBanner";
import { ProviderConnections } from "@/components/auth/ProviderConnections";
import { appRoutes } from "@/lib/shared/routes";
import { Button, Field, FormSection, InlineNotice, LoadingCard, PageHeader, SurfaceCard, TextInput } from "@/components/ui";
import {
    ProfessionalProfileEditor,
    ProfessionalProfileEditorInitialData,
    ProfessionalProfileSubmitPayload,
} from "@/components/profile/ProfessionalProfileEditor";

interface StripeAccountData {
    accountId: string | null;
    payoutsEnabled?: boolean;
    chargesEnabled?: boolean;
    detailsSubmitted?: boolean;
}

function ProfessionalSettingsPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const successParam = searchParams.get("success");
    const errorParam = searchParams.get("error");

    const [profile, setProfile] = useState<ProfessionalProfileEditorInitialData | null>(null);
    const [stripeAccount, setStripeAccount] = useState<StripeAccountData | null>(null);
    const [loading, setLoading] = useState(true);

    const [verificationSent, setVerificationSent] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [corporateEmail, setCorporateEmail] = useState("");
    const { notification, notify, clear } = useNotification();

    const loadData = useCallback(async () => {
        const [settingsPayload, stripePayload] = await Promise.all([
            fetch(appRoutes.api.shared.settings).then((res) => res.json()),
            fetch(appRoutes.api.shared.stripeAccount).then((res) => res.json()),
        ]);

        const settingsData = settingsPayload?.data as ProfessionalProfileEditorInitialData | null | undefined;
        if (settingsData) {
            setProfile(settingsData);
            setCorporateEmail(settingsData.corporateEmail || "");
        }

        if (typeof stripePayload?.accountId !== "undefined") {
            setStripeAccount(stripePayload as StripeAccountData);
        }
    }, []);

    useEffect(() => {
        loadData()
            .catch(() => {
                notify("error", "Could not load professional settings.");
            })
            .finally(() => setLoading(false));
    }, [loadData, notify]);

    useEffect(() => {
        if (!successParam && !errorParam) return;

        if (successParam) {
            notify("success", "Stripe account connected successfully.");
            void loadData();
        }

        if (errorParam) {
            notify("error", "Stripe connection failed. Please try again.");
        }

        router.replace(appRoutes.professional.settings);
    }, [successParam, errorParam, router, notify, loadData]);

    const handleProfileSave = async (payload: ProfessionalProfileSubmitPayload) => {
        clear();
        const trimmedCorporateEmail = corporateEmail.trim();
        if (!trimmedCorporateEmail) {
            throw new Error("Corporate email is required.");
        }
        const payloadWithVerificationEmail = {
            ...payload,
            corporateEmail: trimmedCorporateEmail,
        };

        const response = await fetch(appRoutes.api.shared.settings, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadWithVerificationEmail),
        });

        const responsePayload = (await response.json().catch(() => null)) as
            | { error?: string; details?: { fieldErrors?: Record<string, string[]> } }
            | null;

        if (!response.ok) {
            if (responsePayload?.error === "validation_error") {
                throw new Error("Review required professional fields and try again.");
            }

            throw new Error(responsePayload?.error || "Could not save professional settings");
        }

        await loadData();
        setCorporateEmail(payloadWithVerificationEmail.corporateEmail);
        notify("success", "Profile settings saved.");
    };

    const handleConnectStripe = async () => {
        clear();
        try {
            const res = await fetch(appRoutes.api.professional.onboarding, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ context: "settings" }),
            });
            const data = await res.json();
            if (data.data?.url) {
                window.location.href = data.data.url;
                return;
            }
            throw new Error("Unable to start Stripe onboarding");
        } catch (error) {
            console.error(error);
            notify("error", "Failed to initiate Stripe onboarding.");
        }
    };

    const handleVerifyEmail = async () => {
        if (!corporateEmail.trim()) {
            notify("error", "Enter a corporate email before requesting verification.");
            return;
        }

        try {
            const res = await fetch(appRoutes.api.shared.verificationRequest, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: corporateEmail }),
            });

            if (!res.ok) {
                throw new Error("Could not send verification email");
            }

            setVerificationSent(true);
            notify("success", "Verification email sent. Check your inbox for the code.");
        } catch (error) {
            console.error(error);
            notify("error", "Failed to send verification email.");
        }
    };

    const handleConfirmVerification = async () => {
        if (!verificationCode.trim()) return;

        setVerifying(true);
        clear();
        try {
            const res = await fetch(appRoutes.api.shared.verificationConfirm, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: verificationCode }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Verification failed");
            }

            setProfile((prev) => ({ ...(prev || {}), verifiedAt: new Date().toISOString() }));
            setVerificationSent(false);
            setVerificationCode("");
            notify("success", "Email verified successfully.");
        } catch (error) {
            console.error(error);
            notify("error", "Verification code is invalid or expired.");
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <main className="space-y-8">
                <LoadingCard
                    className="max-w-4xl mx-auto"
                    title="Loading professional settings"
                    description="Pulling payout, profile, and verification state."
                />
            </main>
        );
    }

    const stripeConnected = Boolean(stripeAccount?.accountId);
    const stripeReady = stripeConnected && stripeAccount?.payoutsEnabled;

    return (
        <main className="space-y-8">
            <div className="max-w-4xl mx-auto">
                <PageHeader
                    eyebrow="Professional settings"
                    title="Profile, payout, and verification"
                    description="Keep your consulting profile and payout setup production-ready."
                    className="mb-8"
                />

                <NotificationBanner notification={notification} className="mb-6" />

                <SurfaceCard className="mb-8">
                    <FormSection
                        title="Payouts"
                        description="Connect Stripe to receive payouts from completed and QC-approved bookings."
                        actions={
                            <Button onClick={handleConnectStripe}>
                                {stripeConnected ? "Manage Stripe Connection" : "Connect Stripe for Payouts"}
                            </Button>
                        }
                    >
                        <InlineNotice tone={stripeReady ? "success" : "warning"} title="Payout status">
                            {stripeReady
                                ? "Stripe account connected and payouts enabled."
                                : "Stripe is not fully connected yet."}
                        </InlineNotice>
                    </FormSection>
                </SurfaceCard>

                <SurfaceCard className="space-y-8">
                    <PageHeader
                        eyebrow="Profile details"
                        title="Public profile and verification"
                        description="Keep this information current so sessions and payouts stay frictionless."
                        className="mb-6"
                    />
                    <ProfessionalProfileEditor
                        mode="settings"
                        initialData={profile || undefined}
                        submitLabel="Save settings"
                        submittingLabel="Saving..."
                        onSubmit={handleProfileSave}
                        onCorporateEmailDraftChange={setCorporateEmail}
                        corporateEmailOverride={corporateEmail}
                    />

                    <FormSection
                        title="Verification"
                        description="Use your current corporate inbox to verify the address attached to your consulting profile."
                        actions={
                            <Button type="button" onClick={handleVerifyEmail} disabled={verificationSent}>
                                {verificationSent ? "Sent" : "Send Code"}
                            </Button>
                        }
                    >
                        <Field label="Corporate email" htmlFor="corporate-email-verification">
                            <TextInput
                                id="corporate-email-verification"
                                type="email"
                                value={corporateEmail}
                                onChange={(event) => setCorporateEmail(event.target.value)}
                            />
                        </Field>

                        {verificationSent ? (
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                <Field
                                    label="Verification code"
                                    htmlFor="verification-code"
                                    hint="Use the most recent code sent to your inbox."
                                >
                                    <TextInput
                                        id="verification-code"
                                        type="text"
                                        value={verificationCode}
                                        onChange={(event) => setVerificationCode(event.target.value)}
                                        placeholder="XXXXXX"
                                    />
                                </Field>
                                <Button
                                    type="button"
                                    onClick={handleConfirmVerification}
                                    disabled={verifying || !verificationCode}
                                    loading={verifying}
                                    loadingLabel="Verifying..."
                                >
                                    Confirm
                                </Button>
                            </div>
                        ) : profile?.verifiedAt ? (
                            <InlineNotice tone="success" title="Verified">
                                Verified on {new Date(profile.verifiedAt).toLocaleDateString()}
                            </InlineNotice>
                        ) : (
                            <InlineNotice tone="warning" title="Awaiting verification">
                                Email is not verified yet.
                            </InlineNotice>
                        )}
                    </FormSection>
                </SurfaceCard>

                <div className="mt-8">
                    <ProviderConnections />
                </div>
            </div>
        </main>
    );
}

export default function ProfessionalSettingsPage() {
    return (
        <Suspense
            fallback={
                <main className="space-y-8">
                    <LoadingCard
                        className="max-w-4xl mx-auto"
                        title="Loading professional settings"
                        description="Preparing your settings workspace."
                    />
                </main>
            }
        >
            <ProfessionalSettingsPageContent />
        </Suspense>
    );
}
