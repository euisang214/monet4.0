import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { jsonHandledError, withRoleBodyContext } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { z } from 'zod';

const DisputeSchema = z.object({
    reason: z.enum(['no_show', 'quality', 'misrepresentation', 'other']),
    description: z.string().min(10)
});

export const POST = withRoleBodyContext(
    Role.CANDIDATE,
    DisputeSchema,
    async (_request: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        const { id } = await params;

        try {
            await CandidateBookings.initiateDispute(user.id, id, body.reason, body.description);
            return Response.json({ success: true });
        } catch (error: unknown) {
            console.error('Dispute error:', error);
            return jsonHandledError(error, 'internal_error', 400);
        }
    }
);
