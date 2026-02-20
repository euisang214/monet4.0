import { auth } from '@/auth';
import { getErrorMessage, getErrorStatus, withRole } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { Role } from '@prisma/client';

const requestSchema = z.object({
    reason: z.string().optional()
});

export const POST = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        const { id } = await params;

        const body = await req.json();
        const { reason } = requestSchema.parse(body);

        const booking = await ProfessionalRescheduleService.requestReschedule(
            id,
            session.user.id,
            reason
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error requesting reschedule:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        const status = getErrorStatus(error, 400);
        const message = getErrorMessage(error, 'Internal Error');
        return Response.json({ error: message }, { status });
    }
});
