import { auth } from '@/auth';
import { getErrorMessage, getErrorStatus, withRole } from '@/lib/core/api-helpers';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

export const POST = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        const booking = await ProfessionalRescheduleService.rejectReschedule(
            id,
            session.user.id
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error rejecting reschedule:', error);
        const status = getErrorStatus(error, 400);
        const message = getErrorMessage(error, 'Internal Error');
        return Response.json({ error: message }, { status });
    }
});
