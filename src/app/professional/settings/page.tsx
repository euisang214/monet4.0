"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/primitives/Button";
import { useNotification } from "@/components/ui/hooks/useNotification";
import { NotificationBanner } from "@/components/ui/composites/NotificationBanner";
import { ProviderConnections } from "@/components/auth/ProviderConnections";
import { appRoutes } from "@/lib/shared/routes";
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

        const response = await fetch(appRoutes.api.shared.settings, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
        setCorporateEmail(payload.corporateEmail);
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
            <main className="container py-8">
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
                    <p className="text-sm text-gray-600">Loading professional settings...</p>
                </div>
            </main>
        );
    }

    const stripeConnected = Boolean(stripeAccount?.accountId);
    const stripeReady = stripeConnected && stripeAccount?.payoutsEnabled;

    return (
        <main className="container py-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8">
                    <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Settings</p>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile, payout, and verification</h1>
                    <p className="text-gray-600">Keep your consulting profile and payout setup production-ready.</p>
                </header>

                <NotificationBanner notification={notification} />

                <section className="mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Payouts</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Connect Stripe to receive payouts from completed and QC-approved bookings.
                    </p>
                    <p className={`text-sm font-medium mb-4 ${stripeReady ? "text-green-700" : "text-gray-600"}`}>
                        {stripeReady ? "Stripe account connected and payouts enabled." : "Stripe is not fully connected yet."}
                    </p>
                    <Button onClick={handleConnectStripe} className="bg-indigo-600 hover:bg-indigo-700">
                        {stripeConnected ? "Manage Stripe Connection" : "Connect Stripe for Payouts"}
                    </Button>
                </section>

                <section className="space-y-8 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">Profile Details</h2>
                    <ProfessionalProfileEditor
                        mode="settings"
                        initialData={profile || undefined}
                        submitLabel="Save settings"
                        submittingLabel="Saving..."
                        onSubmit={handleProfileSave}
                        onCorporateEmailDraftChange={setCorporateEmail}
                    />

                    <section className="pt-6 border-t">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Verification</h2>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1" htmlFor="corporate-email-verification">
                                    Corporate email
                                </label>
                                <input
                                    id="corporate-email-verification"
                                    type="email"
                                    value={corporateEmail}
                                    onChange={(event) => setCorporateEmail(event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                />
                            </div>
                            <Button type="button" onClick={handleVerifyEmail} disabled={verificationSent}>
                                {verificationSent ? "Sent" : "Send Code"}
                            </Button>
                        </div>

                        {profile?.verifiedAt ? (
                            <p className="text-sm text-green-700 mt-3">
                                Verified on {new Date(profile.verifiedAt).toLocaleDateString()}
                            </p>
                        ) : verificationSent ? (
                            <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                                <label className="block text-sm font-medium mb-1" htmlFor="verification-code">
                                    Verification code
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="verification-code"
                                        type="text"
                                        value={verificationCode}
                                        onChange={(event) => setVerificationCode(event.target.value)}
                                        className="flex-1 p-2 border rounded-md"
                                        placeholder="XXXXXX"
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleConfirmVerification}
                                        disabled={verifying || !verificationCode}
                                    >
                                        {verifying ? "Verifying..." : "Confirm"}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 mt-3">Email is not verified yet.</p>
                        )}
                    </section>
                </section>

                <div className="mt-8">
                    <ProviderConnections />
                </div>
            </div>
        </main>
    );
}

export default function ProfessionalSettingsPage() {
    return (
        <Suspense fallback={<div className="container py-12 text-center text-gray-600">Loading...</div>}>
            <ProfessionalSettingsPageContent />
        </Suspense>
    );
}
