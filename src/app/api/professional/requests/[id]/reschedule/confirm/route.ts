import { getErrorMessage, getErrorStatus, withRoleContext } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

const confirmSchema = z.object({
    startAt: z.string().datetime()
});

export const POST = withRoleContext(
    Role.PROFESSIONAL,
    async (req: Request, { user }, { params }: { params: { id: string } }) => {
    try {
        const { id } = params;

        const body = await req.json();
        const { startAt } = confirmSchema.parse(body);

        const booking = await ProfessionalRescheduleService.confirmReschedule(
            id,
            user.id,
            new Date(startAt)
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error confirming reschedule:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        const status = getErrorStatus(error, 400);
        const message = getErrorMessage(error, 'Internal Error');
        return Response.json({ error: message }, { status });
    }
});
