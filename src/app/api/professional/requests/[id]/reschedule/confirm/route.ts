import { jsonHandledError, withRoleBodyContext } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

const confirmSchema = z.object({
    startAt: z.string().datetime()
});

export const POST = withRoleBodyContext(
    Role.PROFESSIONAL,
    confirmSchema,
    async (_req: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        try {
            const { id } = await params;

            const booking = await ProfessionalRescheduleService.confirmReschedule(
                id,
                user.id,
                new Date(body.startAt)
            );

            return Response.json({ data: booking });
        } catch (error: unknown) {
            console.error('Error confirming reschedule:', error);
            return jsonHandledError(error, 'Internal Error', 400, 'Validation Error');
        }
    },
    { validationError: 'Validation Error' }
);
