import { auth } from '@/auth';
import { VerificationService } from '@/lib/domain/users/verification-service';
import { checkRateLimit } from '@/lib/core/rate-limit';

/**
 * POST /api/shared/verification/confirm
 * 
 * Confirm a verification token.
 * Delegates to VerificationService for atomic 3-table update.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Rate limit: 10 attempts per hour (guessing code)
    const isAllowed = await checkRateLimit(session.user.id, 10, 3600 * 1000);
    if (!isAllowed) {
        return Response.json({ error: 'too_many_requests' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const { token } = body;

        if (!token || typeof token !== 'string') {
            return Response.json({ error: 'validation_error' }, { status: 400 });
        }

        await VerificationService.confirmVerification(session.user.id, token);

        return Response.json({ message: 'Email verified successfully' });
    } catch (error: any) {
        if (error.message === 'invalid_code') {
            return Response.json({ error: 'invalid_code' }, { status: 400 });
        }
        console.error('Verification confirm error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
