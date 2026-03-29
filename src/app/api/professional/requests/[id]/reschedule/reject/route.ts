import { jsonHandledError, withRoleContext } from '@/lib/core/api-helpers';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

export const POST = withRoleContext(
    Role.PROFESSIONAL,
    async (req: Request, { user }, { params }: { params: Promise<{ id: string }> }) => {
    try {
        const { id } = await params;

        const booking = await ProfessionalRescheduleService.rejectReschedule(
            id,
            user.id
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error rejecting reschedule:', error);
        return jsonHandledError(error, 'Internal Error', 400, 'Validation Error');
    }
});
