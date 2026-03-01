"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { appRoutes } from "@/lib/shared/routes";
import { Button } from "@/components/ui/primitives/Button";
import { NotificationBanner } from "@/components/ui/composites/NotificationBanner";
import { useNotification } from "@/components/ui/hooks/useNotification";
import {
    CandidateProfileEditor,
    CandidateProfileEditorInitialData,
    CandidateProfileSubmitPayload,
} from "@/components/profile/CandidateProfileEditor";
import {
    ProfessionalProfileEditor,
    ProfessionalProfileEditorInitialData,
    ProfessionalProfileSubmitPayload,
    ProfessionalStripeStatus,
} from "@/components/profile/ProfessionalProfileEditor";

interface OnboardingFormProps {
    role: Role;
    initialTimezone: string;
    initialCandidate?: Omit<CandidateProfileEditorInitialData, "timezone">;
    initialProfessional?: Omit<ProfessionalProfileEditorInitialData, "timezone">;
    initialProfessionalEmailVerified?: boolean;
}

type OnboardingSubmitPayload = CandidateProfileSubmitPayload | ProfessionalProfileSubmitPayload;

function postOnboardingPath(role: Role) {
    return role === Role.PROFESSIONAL ? appRoutes.professional.dashboard : appRoutes.candidate.browse;
}

function normalizeCorporateEmail(value: string | null | undefined) {
    return (value || "").trim().toLowerCase();
}

export function OnboardingForm({
    role,
    initialTimezone,
    initialCandidate,
    initialProfessional,
    initialProfessionalEmailVerified = false,
}: OnboardingFormProps) {
    const router = useRouter();
    const { update } = useSession();
    const [stripeStatus, setStripeStatus] = useState<ProfessionalStripeStatus | null>(null);
    const [corporateEmail, setCorporateEmail] = useState(initialProfessional?.corporateEmail || "");
    const [verificationSent, setVerificationSent] = useState(false);
    const [verificationCode, setVerificationCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [verificationTargetEmailNormalized, setVerificationTargetEmailNormalized] = useState("");
    const [verifiedEmailNormalized, setVerifiedEmailNormalized] = useState(() => {
        if (role !== Role.PROFESSIONAL) return "";
        if (!initialProfessionalEmailVerified || !initialProfessional?.verifiedAt) return "";
        return normalizeCorporateEmail(initialProfessional?.corporateEmail);
    });
    const { notification, notify, clear } = useNotification();

    useEffect(() => {
        let isMounted = true;

        const load = async () => {
            if (role !== Role.PROFESSIONAL) return;

            try {
                const response = await fetch(appRoutes.api.shared.stripeAccount);
                const payload = (await response.json().catch(() => null)) as ProfessionalStripeStatus | null;
                const status = response.ok && payload ? payload : null;
                if (isMounted && status) {
                    setStripeStatus(status);
                }
            } catch (error) {
                console.error(error);
            }
        };

        void load();

        return () => {
            isMounted = false;
        };
    }, [role]);

    useEffect(() => {
        if (role !== Role.PROFESSIONAL) return;
        const nextCorporateEmail = initialProfessional?.corporateEmail || "";
        setCorporateEmail(nextCorporateEmail);
    }, [role, initialProfessional?.corporateEmail]);

    useEffect(() => {
        if (!verificationSent) return;

        const normalizedCurrentEmail = normalizeCorporateEmail(corporateEmail);
        if (normalizedCurrentEmail !== verificationTargetEmailNormalized) {
            setVerificationSent(false);
            setVerificationCode("");
            setVerificationTargetEmailNormalized("");
        }
    }, [corporateEmail, verificationSent, verificationTargetEmailNormalized]);

    const normalizedCorporateEmail = normalizeCorporateEmail(corporateEmail);
    const isVerifiedForCurrentEmail =
        normalizedCorporateEmail.length > 0 && normalizedCorporateEmail === verifiedEmailNormalized;

    const submitOnboarding = async (payload: OnboardingSubmitPayload) => {
        clear();
        const response = await fetch(appRoutes.api.auth.onboarding, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const result = (await response.json().catch(() => null)) as
            | { error?: string; data?: { onboardingRequired?: boolean; onboardingCompleted?: boolean } }
            | null;

        if (!response.ok) {
            if (result?.error === "stripe_payout_not_ready") {
                throw new Error("Connect Stripe payouts before completing onboarding.");
            }

            if (result?.error === "validation_error") {
                throw new Error("Review required profile fields and try again.");
            }
            if (result?.error === "corporate_email_not_verified") {
                throw new Error("Verify your corporate email before completing onboarding.");
            }

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
    };

    const handleConnectStripe = async () => {
        const response = await fetch(appRoutes.api.professional.onboarding, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ context: "onboarding" }),
        });

        const payload = (await response.json().catch(() => null)) as { data?: { url?: string }; error?: string } | null;

        if (!response.ok || !payload?.data?.url) {
            throw new Error(payload?.error || "Unable to start Stripe onboarding");
        }

        window.location.href = payload.data.url;
    };

    const handleVerifyEmail = async () => {
        if (!normalizedCorporateEmail) {
            notify("error", "Enter a corporate email before requesting verification.");
            return;
        }

        clear();
        try {
            const response = await fetch(appRoutes.api.shared.verificationRequest, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: corporateEmail }),
            });
            if (!response.ok) {
                throw new Error("request_failed");
            }

            setVerificationTargetEmailNormalized(normalizedCorporateEmail);
            setVerificationSent(true);
            setVerificationCode("");
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
            const response = await fetch(appRoutes.api.shared.verificationConfirm, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: verificationCode.trim() }),
            });
            const payload = (await response.json().catch(() => null)) as { error?: string } | null;

            if (!response.ok) {
                throw new Error(payload?.error || "verification_failed");
            }

            setVerifiedEmailNormalized(verificationTargetEmailNormalized || normalizedCorporateEmail);
            setVerificationSent(false);
            setVerificationCode("");
            setVerificationTargetEmailNormalized("");
            notify("success", "Corporate email verified successfully.");
        } catch (error) {
            console.error(error);
            notify("error", "Verification code is invalid or expired.");
        } finally {
            setVerifying(false);
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
            <NotificationBanner notification={notification} />

            {role === Role.CANDIDATE ? (
                <CandidateProfileEditor
                    mode="onboarding"
                    initialData={{
                        firstName: initialCandidate?.firstName,
                        lastName: initialCandidate?.lastName,
                        timezone: initialTimezone,
                        resumeUrl: initialCandidate?.resumeUrl,
                        interests: initialCandidate?.interests,
                        experience: initialCandidate?.experience,
                        activities: initialCandidate?.activities,
                        education: initialCandidate?.education,
                    }}
                    submitLabel="Complete onboarding"
                    submittingLabel="Saving..."
                    onSubmit={submitOnboarding}
                />
            ) : (
                <div className="space-y-6">
                    <ProfessionalProfileEditor
                        mode="onboarding"
                        initialData={{
                            firstName: initialProfessional?.firstName,
                            lastName: initialProfessional?.lastName,
                            timezone: initialTimezone,
                            bio: initialProfessional?.bio,
                            price: initialProfessional?.price,
                            corporateEmail: initialProfessional?.corporateEmail,
                            interests: initialProfessional?.interests,
                            experience: initialProfessional?.experience,
                            activities: initialProfessional?.activities,
                            education: initialProfessional?.education,
                            title: initialProfessional?.title,
                            employer: initialProfessional?.employer,
                        }}
                        submitLabel="Complete onboarding"
                        submittingLabel="Saving..."
                        onSubmit={submitOnboarding}
                        requirePayoutReady
                        stripeStatus={stripeStatus}
                        onConnectStripe={handleConnectStripe}
                        onCorporateEmailDraftChange={setCorporateEmail}
                        requireCorporateVerification
                        isCorporateEmailVerified={isVerifiedForCurrentEmail}
                        corporateVerificationMessage="Verify your corporate email to complete onboarding."
                    />

                    <section className="space-y-4 rounded-md border border-gray-200 p-4 bg-gray-50">
                        <h2 className="text-lg font-semibold text-gray-900">Corporate Email Verification</h2>
                        <p className="text-sm text-gray-600">
                            Verify the corporate email listed in your profile before completing onboarding.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                onClick={handleVerifyEmail}
                                disabled={verificationSent || !normalizedCorporateEmail}
                            >
                                {verificationSent ? "Sent" : "Send Code"}
                            </Button>
                        </div>

                        {verificationSent ? (
                            <div className="space-y-2">
                                <label className="block text-sm font-medium" htmlFor="onboarding-verification-code">
                                    Verification code
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        id="onboarding-verification-code"
                                        type="text"
                                        value={verificationCode}
                                        onChange={(event) => setVerificationCode(event.target.value)}
                                        className="flex-1 p-2 border rounded-md"
                                        placeholder="XXXXXX"
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleConfirmVerification}
                                        disabled={verifying || !verificationCode.trim()}
                                    >
                                        {verifying ? "Verifying..." : "Confirm"}
                                    </Button>
                                </div>
                            </div>
                        ) : isVerifiedForCurrentEmail ? (
                            <p className="text-sm text-green-700">Corporate email is verified.</p>
                        ) : (
                            <p className="text-sm text-amber-700">
                                Verify your corporate email to complete onboarding.
                            </p>
                        )}
                    </section>
                </div>
            )}
        </section>
    );
}
