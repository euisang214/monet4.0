import { auth } from '@/auth';
import { withRole } from '@/lib/core/api-helpers';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

export const GET = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const slots = await ProfessionalRescheduleService.getRescheduleAvailability(
            params.id,
            session.user.id
        );

        return Response.json({ data: slots });
    } catch (error: unknown) {
        console.error('Error fetching reschedule availability:', error);
        const message = error instanceof Error ? error.message : 'Internal Error';
        return Response.json({ error: message }, { status: 400 });
    }
});
