import { jsonHandledError, withRoleBodyContext } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { Role } from '@prisma/client';

const declineSchema = z.object({
    reason: z.string().optional()
});

export const POST = withRoleBodyContext(
    Role.PROFESSIONAL,
    declineSchema,
    async (_req: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        try {
            const { id } = await params;

            const booking = await ProfessionalRequestService.declineBooking(
                id,
                user.id,
                body.reason
            );

            return Response.json({ data: booking });
        } catch (error: unknown) {
            console.error('Error declining booking:', error);
            return jsonHandledError(error, 'Internal Error', 400, 'Validation Error');
        }
    },
    { validationError: 'Validation Error' }
);
