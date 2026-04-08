import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { jsonHandledError, withRoleBodyContext } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { z } from 'zod';

const AcceptRescheduleSchema = z.object({
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
});

export const POST = withRoleBodyContext(
    Role.CANDIDATE,
    AcceptRescheduleSchema,
    async (_request: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params;

        try {
            await CandidateBookings.acceptRescheduleProposal(
                user.id,
                id,
                body.startAt,
                body.endAt
            );
            return Response.json({ success: true });
        } catch (error: unknown) {
            console.error('Accept reschedule error:', error);
            return jsonHandledError(error, 'internal_error', 400);
        }
    }
);
