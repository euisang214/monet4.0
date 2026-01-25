import { auth } from "@/auth"
import { OnboardingService } from "@/lib/domain/users/onboarding-service"

/**
 * POST /api/professional/onboarding
 * 
 * Generate a Stripe Connect onboarding link for professional.
 * Delegates to OnboardingService.generateOnboardingLink.
 */
export async function POST(request: Request) {
    const session = await auth()
    if (!session?.user || session.user.role !== "PROFESSIONAL") {
        return Response.json({ error: "unauthorized" }, { status: 401 })
    }

    try {
        // Build return/refresh URLs
        const origin = request.headers.get("origin") || "http://localhost:3000"
        const refreshUrl = `${origin}/professional/settings?error=stripe_refresh`
        const returnUrl = `${origin}/professional/settings?success=stripe_connected`

        const result = await OnboardingService.generateOnboardingLink(
            session.user.id,
            returnUrl,
            refreshUrl
        )

        return Response.json({ data: result })
    } catch (error: any) {
        if (error.message === 'user_not_found') {
            return Response.json({ error: "user_not_found" }, { status: 404 })
        }
        console.error("Error generating onboarding link:", error)
        return Response.json({ error: "internal_error" }, { status: 500 })
    }
}
