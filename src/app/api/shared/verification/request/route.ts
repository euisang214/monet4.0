import { auth } from '@/auth';
import { VerificationService } from '@/lib/domain/users/verification-service';
import { checkRateLimit } from '@/lib/core/rate-limit';
import { z } from 'zod';

const VerificationRequestSchema = z.object({
    email: z.string().email(),
});

/**
 * POST /api/shared/verification/request
 * 
 * Request email verification.
 * Delegates to VerificationService for token creation and email sending.
 */
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Rate limit: 5 attempts per hour per user
    const isAllowed = await checkRateLimit(session.user.id, 5, 3600 * 1000);
    if (!isAllowed) {
        return Response.json({ error: 'too_many_requests' }, { status: 429 });
    }

    try {
        const body = await req.json();
        const parsed = VerificationRequestSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: 'validation_error', details: parsed.error }, { status: 400 });
        }

        await VerificationService.createVerification(session.user.id, parsed.data.email);

        return Response.json({ message: 'Verification email sent' });
    } catch (error) {
        console.error('Verification request error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
