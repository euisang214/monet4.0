import { getErrorMessage, getErrorStatus, withRoleContext } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { Role } from '@prisma/client';

const declineSchema = z.object({
    reason: z.string().optional()
});

export const POST = withRoleContext(
    Role.PROFESSIONAL,
    async (req: Request, { user }, { params }: { params: { id: string } }) => {
    try {
        const { id } = params;

        const body = await req.json();
        const { reason } = declineSchema.parse(body);

        const booking = await ProfessionalRequestService.declineBooking(
            id,
            user.id,
            reason
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error declining booking:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        const status = getErrorStatus(error, 400);
        const message = getErrorMessage(error, 'Internal Error');
        return Response.json({ error: message }, { status });
    }
});
