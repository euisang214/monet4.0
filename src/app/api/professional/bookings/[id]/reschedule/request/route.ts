import { auth } from '@/auth';
import { withRole } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

const requestSchema = z.object({
    reason: z.string().optional()
});

export const POST = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { reason } = requestSchema.parse(body);

        const booking = await ProfessionalRescheduleService.requestReschedule(
            params.id,
            session.user.id,
            reason
        );

        return Response.json({ data: booking });
    } catch (error: any) {
        console.error('Error requesting reschedule:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        return Response.json({ error: error.message || 'Internal Error' }, { status: 400 });
    }
});
