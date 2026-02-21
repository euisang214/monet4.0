import { auth } from '@/auth';

/**
 * GET /api/auth/role
 * 
 * Returns the current user's role.
 */
export async function GET() {
    const session = await auth();

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    return Response.json({
        role: session.user.role,
        userId: session.user.id,
        onboardingRequired: session.user.onboardingRequired,
        onboardingCompleted: session.user.onboardingCompleted,
    });
}
