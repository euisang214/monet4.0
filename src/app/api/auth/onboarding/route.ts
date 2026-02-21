import { auth } from "@/auth";
import { prisma } from "@/lib/core/db";
import { Role } from "@prisma/client";
import {
    buildResumeRequiredValidationError,
    candidateProfilePayloadSchema,
    professionalProfilePayloadSchema,
    upsertCandidateProfileFromPayload,
    upsertProfessionalProfileFromPayload,
} from "@/lib/domain/users/profile-upsert-service";
import { getProfessionalStripeStatus } from "@/lib/domain/users/professional-stripe-status";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const userId = session.user.id;
        const role = session.user.role as Role;

        if (role === Role.CANDIDATE) {
            const parsed = candidateProfilePayloadSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            const result = await upsertCandidateProfileFromPayload(userId, parsed.data, {
                markOnboardingCompleted: true,
            });

            if (!result.success && result.error === "resume_required") {
                return Response.json(buildResumeRequiredValidationError(), { status: 400 });
            }
        } else if (role === Role.PROFESSIONAL) {
            const parsed = professionalProfilePayloadSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            const userOnboardingState = await prisma.user.findUnique({
                where: { id: userId },
                select: { onboardingCompleted: true },
            });

            if (userOnboardingState?.onboardingCompleted !== true) {
                const stripeStatus = await getProfessionalStripeStatus(userId);
                if (!stripeStatus.isPayoutReady) {
                    return Response.json({ error: "stripe_payout_not_ready" }, { status: 400 });
                }
            }

            await upsertProfessionalProfileFromPayload(userId, parsed.data, {
                markOnboardingCompleted: true,
            });
        } else {
            return Response.json({ error: "unsupported_role" }, { status: 400 });
        }

        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                onboardingRequired: true,
                onboardingCompleted: true,
            },
        });

        return Response.json({
            data: {
                success: true,
                onboardingRequired: updatedUser?.onboardingRequired ?? false,
                onboardingCompleted: updatedUser?.onboardingCompleted ?? true,
            },
        });
    } catch (error) {
        console.error("Onboarding completion error:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
