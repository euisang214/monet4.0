import { auth } from '@/auth';
import { VerificationService } from '@/lib/domain/users/verification-service';

/**
 * GET /api/shared/verification/status
 * 
 * Returns the current user's verification status.
 * Delegates to VerificationService.
 */
export async function GET() {
    const session = await auth();

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const status = await VerificationService.getVerificationStatus(session.user.id);

    return Response.json(status);
}
