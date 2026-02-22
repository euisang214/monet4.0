import { withRoleContext } from '@/lib/core/api-helpers';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

export const GET = withRoleContext(
    Role.PROFESSIONAL,
    async (req: Request, { user }, { params }: { params: { id: string } }) => {
    try {
        const { id } = params;

        const slots = await ProfessionalRescheduleService.getRescheduleAvailability(
            id,
            user.id
        );

        return Response.json({ data: slots });
    } catch (error: unknown) {
        console.error('Error fetching reschedule availability:', error);
        const message = error instanceof Error ? error.message : 'Internal Error';
        return Response.json({ error: message }, { status: 400 });
    }
});
