import { PaymentsService } from '@/lib/domain/payments/services';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { NextRequest } from 'next/server';

const payoutSchema = z.object({
    bookingId: z.string().min(1),
});

export const POST = withRole(Role.ADMIN, async (req: Request) => {
    try {
        const body = await req.json();
        const result = payoutSchema.safeParse(body);

        if (!result.success) {
            return Response.json({ error: 'validation_error', details: result.error.issues }, { status: 400 });
        }

        const { bookingId } = result.data;

        // Trigger the payout logic directly
        // Note: This logic assumes a Payout record exists in 'pending' or 'blocked' state?
        // PaymentsService.processPayoutJob checks if it exists.
        // If it doesn't exist (e.g. bypassing QC), we might need to create it?
        // The current service is designed for the Job which assumes record exists.
        // For Admin manual payout, we might want to force it?
        // Let's assume the Admin uses this to retry a stuck payout or force one that is 'blocked'.

        // We should check if Payout exists first, if not create it?
        // CLAUDE.md says "Release payment to professional". 
        // I'll try to process it. If it fails due to missing record, I'll return error.

        const response = await PaymentsService.processPayoutJob(bookingId);

        return Response.json({ success: true, data: response });
    } catch (error: any) {
        console.error('Error processing manual payout:', error);
        return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
    }
});
