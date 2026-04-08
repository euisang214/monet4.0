import { jsonHandledError, withRoleBodyContext } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

const requestSchema = z.object({
    slots: z.array(z.object({
        start: z.coerce.date(),
        end: z.coerce.date(),
    })).min(1),
    reason: z.string().optional(),
});

export const POST = withRoleBodyContext(
    Role.PROFESSIONAL,
    requestSchema,
    async (_req: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        try {
            const { id } = await params;

            const booking = await ProfessionalRescheduleService.requestReschedule(
                id,
                user.id,
                body.slots,
                body.reason
            );

            return Response.json({ data: booking });
        } catch (error: unknown) {
            console.error('Error requesting reschedule:', error);
            return jsonHandledError(error, 'Internal Error', 400, 'Validation Error');
        }
    },
    { validationError: 'Validation Error' }
);
