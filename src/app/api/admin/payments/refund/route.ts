import { PaymentsService } from '@/lib/domain/payments/services';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { auth } from '@/auth';

const refundSchema = z.object({
    bookingId: z.string().min(1),
    amountCents: z.number().int().positive().optional(),
});

export const POST = withRole(Role.ADMIN, async (req: Request) => {
    try {
        const body = await req.json();
        const result = refundSchema.safeParse(body);

        if (!result.success) {
            return Response.json({ error: 'validation_error', details: result.error.issues }, { status: 400 });
        }

        const { bookingId, amountCents } = result.data;

        // Get admin user ID for audit log
        const session = await auth();
        const adminUserId = session?.user?.id;

        await PaymentsService.processManualRefund(bookingId, amountCents, adminUserId);

        return Response.json({ success: true });
    } catch (error: unknown) {
        console.error('Error processing manual refund:', error);

        // Handle known error codes
        if (error instanceof Error) {
            const knownErrors = ['booking_not_found', 'payment_not_found', 'already_fully_refunded', 'amount_exceeds_refundable'];
            if (knownErrors.includes(error.message)) {
                const status = error.message.includes('not_found') ? 404 : 400;
                return Response.json({ error: error.message }, { status });
            }
        }

        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
});
