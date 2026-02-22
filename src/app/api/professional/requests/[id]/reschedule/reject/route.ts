import { getErrorMessage, getErrorStatus, withRoleContext } from '@/lib/core/api-helpers';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

export const POST = withRoleContext(
    Role.PROFESSIONAL,
    async (req: Request, { user }, { params }: { params: { id: string } }) => {
    try {
        const { id } = params;

        const booking = await ProfessionalRescheduleService.rejectReschedule(
            id,
            user.id
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error rejecting reschedule:', error);
        const status = getErrorStatus(error, 400);
        const message = getErrorMessage(error, 'Internal Error');
        return Response.json({ error: message }, { status });
    }
});
