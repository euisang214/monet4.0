import { auth } from "@/auth";
import { Role } from "@prisma/client";
import { submitProfilePayload } from "@/lib/domain/users/profile-submit-service";

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const userId = session.user.id;
        const role = session.user.role as Role;
        const submission = await submitProfilePayload({
            userId,
            role,
            body,
            mode: "onboarding",
        });

        if (!submission.success) {
            return Response.json(
                submission.details ? { error: submission.error, details: submission.details } : { error: submission.error },
                { status: submission.status }
            );
        }

        return Response.json({
            data: {
                success: true,
                onboardingRequired: submission.onboardingRequired,
                onboardingCompleted: submission.onboardingCompleted,
            },
        });
    } catch (error) {
        console.error("Onboarding completion error:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
