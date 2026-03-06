"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { appRoutes } from "@/lib/shared/routes";
import { NotificationBanner } from "@/components/ui/composites/NotificationBanner";
import { useNotification } from "@/components/ui/hooks/useNotification";
import { Button, Field, FormSection, InlineNotice, PageHeader, SurfaceCard, TextInput } from "@/components/ui";
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
        if (role !== Role.PROFESSIONAL) {
            setVerifiedEmailNormalized("");
            return;
        }

        if (!initialProfessionalEmailVerified || !initialProfessional?.verifiedAt) {
            setVerifiedEmailNormalized("");
            return;
        }

        setVerifiedEmailNormalized(normalizeCorporateEmail(initialProfessional?.corporateEmail));
    }, [
        initialProfessional?.corporateEmail,
        initialProfessional?.verifiedAt,
        initialProfessionalEmailVerified,
        role,
    ]);

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
    const initialVerifiedEmailNormalized =
        role === Role.PROFESSIONAL && initialProfessionalEmailVerified && initialProfessional?.verifiedAt
            ? normalizeCorporateEmail(initialProfessional?.corporateEmail)
            : "";
    const isVerifiedForCurrentEmail =
        normalizedCorporateEmail.length > 0 &&
        (normalizedCorporateEmail === verifiedEmailNormalized ||
            normalizedCorporateEmail === initialVerifiedEmailNormalized);

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
        <SurfaceCard className="w-full max-w-4xl mx-auto" padding="lg">
            <PageHeader
                eyebrow="Onboarding"
                title="Finish setting up your profile"
                description={`Complete required fields to continue as a ${
                    role === Role.PROFESSIONAL ? "professional" : "candidate"
                }.`}
                className="mb-6"
            />
            <NotificationBanner notification={notification} className="mb-6" />

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

                    <FormSection
                        title="Corporate Email Verification"
                        description="Verify the corporate email listed in your profile before completing onboarding."
                        tone="muted"
                        actions={
                            <Button
                                type="button"
                                onClick={handleVerifyEmail}
                                disabled={verificationSent || !normalizedCorporateEmail}
                                variant="secondary"
                            >
                                {verificationSent ? "Sent" : "Send Code"}
                            </Button>
                        }
                    >
                        {isVerifiedForCurrentEmail ? (
                            <InlineNotice tone="success" title="Verified">
                                Corporate email is verified.
                            </InlineNotice>
                        ) : null}

                        {verificationSent ? (
                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                                <Field
                                    label="Verification code"
                                    htmlFor="onboarding-verification-code"
                                    hint="Use the most recent code sent to your corporate email."
                                >
                                    <TextInput
                                        id="onboarding-verification-code"
                                        type="text"
                                        value={verificationCode}
                                        onChange={(event) => setVerificationCode(event.target.value)}
                                        placeholder="XXXXXX"
                                    />
                                </Field>
                                <Button
                                    type="button"
                                    onClick={handleConfirmVerification}
                                    disabled={verifying || !verificationCode.trim()}
                                    loading={verifying}
                                    loadingLabel="Verifying..."
                                >
                                    Confirm
                                </Button>
                            </div>
                        ) : !isVerifiedForCurrentEmail ? (
                            <InlineNotice tone="warning" title="Verification required">
                                Verify your corporate email to complete onboarding.
                            </InlineNotice>
                        ) : null}
                    </FormSection>
                </div>
            )}
        </SurfaceCard>
    );
}
