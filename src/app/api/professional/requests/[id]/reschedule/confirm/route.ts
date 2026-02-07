import { auth } from '@/auth';
import { withRole } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

const confirmSchema = z.object({
    startAt: z.string().datetime()
});

export const POST = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { startAt } = confirmSchema.parse(body);

        const booking = await ProfessionalRescheduleService.confirmReschedule(
            params.id,
            session.user.id,
            new Date(startAt)
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error confirming reschedule:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        const message = error instanceof Error ? error.message : 'Internal Error';
        return Response.json({ error: message }, { status: 400 });
    }
});
