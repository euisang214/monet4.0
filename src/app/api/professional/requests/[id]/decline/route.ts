import { withRole } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { Role } from '@prisma/client';
import { auth } from '@/auth';

const declineSchema = z.object({
    reason: z.string().optional()
});

export const POST = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { reason } = declineSchema.parse(body);

        const booking = await ProfessionalRequestService.declineBooking(
            params.id,
            session.user.id,
            reason
        );

        return Response.json({ data: booking });
    } catch (error: unknown) {
        console.error('Error declining booking:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        const message = error instanceof Error ? error.message : 'Internal Error';
        return Response.json({ error: message }, { status: 400 });
    }
});
