"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { appRoutes } from "@/lib/shared/routes";
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
}

type OnboardingSubmitPayload = CandidateProfileSubmitPayload | ProfessionalProfileSubmitPayload;

function postOnboardingPath(role: Role) {
    return role === Role.PROFESSIONAL ? appRoutes.professional.dashboard : appRoutes.candidate.browse;
}

export function OnboardingForm({
    role,
    initialTimezone,
    initialCandidate,
    initialProfessional,
}: OnboardingFormProps) {
    const router = useRouter();
    const { update } = useSession();
    const [stripeStatus, setStripeStatus] = useState<ProfessionalStripeStatus | null>(null);

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

    const submitOnboarding = async (payload: OnboardingSubmitPayload) => {
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

    return (
        <section className="w-full max-w-4xl mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg">
            <header className="mb-6">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Onboarding</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Finish setting up your profile</h1>
                <p className="text-sm text-gray-600">
                    Complete required fields to continue as a {role === Role.PROFESSIONAL ? "professional" : "candidate"}.
                </p>
            </header>

            {role === Role.CANDIDATE ? (
                <CandidateProfileEditor
                    mode="onboarding"
                    initialData={{
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
                <ProfessionalProfileEditor
                    mode="onboarding"
                    initialData={{
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
                />
            )}
        </section>
    );
}
