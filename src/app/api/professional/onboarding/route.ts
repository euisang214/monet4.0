import { auth } from "@/auth";
import { z } from "zod";
import { OnboardingService } from "@/lib/domain/users/onboarding-service";

const onboardingContextSchema = z
    .object({
        context: z.enum(["onboarding", "settings"]).optional(),
    })
    .strict();

/**
 * POST /api/professional/onboarding
 *
 * Generate a Stripe Connect onboarding link for professional.
 * Delegates to OnboardingService.generateOnboardingLink.
 */
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "PROFESSIONAL") {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const body = (await request.json().catch(() => ({}))) as unknown;
        const parsed = onboardingContextSchema.safeParse(body);
        const context = parsed.success ? parsed.data.context || "settings" : "settings";

        const origin = request.headers.get("origin") || "http://localhost:3000";

        const refreshUrl =
            context === "onboarding"
                ? `${origin}/onboarding?error=stripe_refresh`
                : `${origin}/professional/settings?error=stripe_refresh`;

        const returnUrl =
            context === "onboarding"
                ? `${origin}/onboarding?success=stripe_connected`
                : `${origin}/professional/settings?success=stripe_connected`;

        const result = await OnboardingService.generateOnboardingLink(
            session.user.id,
            returnUrl,
            refreshUrl
        );

        return Response.json({ data: result });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === "user_not_found") {
            return Response.json({ error: "user_not_found" }, { status: 404 });
        }

        console.error("Error generating onboarding link:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
