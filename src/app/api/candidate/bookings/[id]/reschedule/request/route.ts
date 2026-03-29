import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { jsonHandledError, withRoleBodyContext } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { z } from 'zod';

const RescheduleSchema = z.object({
    slots: z.array(z.object({
        start: z.coerce.date(),
        end: z.coerce.date()
    })).min(1),
    reason: z.string().optional(),
    timezone: z.string().optional(),
});

export const POST = withRoleBodyContext(
    Role.CANDIDATE,
    RescheduleSchema,
    async (_request: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params;

        try {
            await CandidateBookings.requestReschedule(
                user.id,
                id,
                body.slots,
                body.reason,
                body.timezone || 'UTC'
            );
            return Response.json({ success: true });
        } catch (error: unknown) {
            console.error('Reschedule error:', error);
            return jsonHandledError(error, 'internal_error', 400);
        }
    }
);
