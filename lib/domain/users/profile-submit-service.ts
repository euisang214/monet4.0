import { Role } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import {
    buildResumeRequiredValidationError,
    candidateProfilePayloadSchema,
    professionalProfilePayloadSchema,
    upsertCandidateProfileFromPayload,
    upsertProfessionalProfileFromPayload,
} from "@/lib/domain/users/profile-upsert-service";
import { getProfessionalStripeStatus } from "@/lib/domain/users/professional-stripe-status";

type SubmitMode = "onboarding" | "settings";

type ProfileSubmissionInput = {
    userId: string;
    role: Role;
    body: unknown;
    mode: SubmitMode;
};

type ProfileSubmissionSuccess = {
    success: true;
    onboardingRequired: boolean;
    onboardingCompleted: boolean;
};

type ProfileSubmissionFailure = {
    success: false;
    status: number;
    error: string;
    details?: unknown;
};

export type ProfileSubmissionResult = ProfileSubmissionSuccess | ProfileSubmissionFailure;

async function readOnboardingState(userId: string): Promise<{
    onboardingRequired: boolean;
    onboardingCompleted: boolean;
}> {
    const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            onboardingRequired: true,
            onboardingCompleted: true,
        },
    });

    return {
        onboardingRequired: updatedUser?.onboardingRequired ?? false,
        onboardingCompleted: updatedUser?.onboardingCompleted ?? true,
    };
}

export async function submitProfilePayload({
    userId,
    role,
    body,
    mode,
}: ProfileSubmissionInput): Promise<ProfileSubmissionResult> {
    const markOnboardingCompleted = mode === "onboarding";

    if (role === Role.CANDIDATE) {
        const parsed = candidateProfilePayloadSchema.safeParse(body);
        if (!parsed.success) {
            return {
                success: false,
                status: 400,
                error: "validation_error",
                details: parsed.error.flatten(),
            };
        }

        const result = await upsertCandidateProfileFromPayload(userId, parsed.data, {
            markOnboardingCompleted,
        });
        if (!result.success && result.error === "resume_required") {
            const payload = buildResumeRequiredValidationError();
            return {
                success: false,
                status: 400,
                error: payload.error,
                details: payload.details,
            };
        }

        const onboardingState = await readOnboardingState(userId);
        return {
            success: true,
            onboardingRequired: onboardingState.onboardingRequired,
            onboardingCompleted: onboardingState.onboardingCompleted,
        };
    }

    if (role === Role.PROFESSIONAL) {
        const parsed = professionalProfilePayloadSchema.safeParse(body);
        if (!parsed.success) {
            return {
                success: false,
                status: 400,
                error: "validation_error",
                details: parsed.error.flatten(),
            };
        }

        if (mode === "onboarding") {
            const userOnboardingState = await prisma.user.findUnique({
                where: { id: userId },
                select: { onboardingCompleted: true },
            });

            if (userOnboardingState?.onboardingCompleted !== true) {
                const stripeStatus = await getProfessionalStripeStatus(userId);
                if (!stripeStatus.isPayoutReady) {
                    return {
                        success: false,
                        status: 400,
                        error: "stripe_payout_not_ready",
                    };
                }
            }
        }

        await upsertProfessionalProfileFromPayload(userId, parsed.data, {
            markOnboardingCompleted,
        });

        const onboardingState = await readOnboardingState(userId);
        return {
            success: true,
            onboardingRequired: onboardingState.onboardingRequired,
            onboardingCompleted: onboardingState.onboardingCompleted,
        };
    }

    return {
        success: false,
        status: 400,
        error: "unsupported_role",
    };
}
