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
    } catch (error: any) {
        console.error('Error fetching reschedule availability:', error);
        return Response.json({ error: error.message || 'Internal Error' }, { status: 400 });
    }
});
