import { jsonHandledError, withRoleBodyContext, withRoleContext } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { Role } from '@prisma/client';

export const GET = withRoleContext(
    Role.PROFESSIONAL,
    async (req: Request, { user }, { params }: { params: Promise<{ id: string }> }) => {
        try {
            const { id } = await params;

            const slots = await ProfessionalRequestService.getBookingCandidateAvailability(
                id,
                user.id
            );
            return Response.json({ data: slots });
        } catch (error: unknown) {
            console.error('Error fetching availability:', error);
            return jsonHandledError(error, 'Internal Error', 400, 'Internal Error');
        }
    });

const confirmSchema = z.object({
    startAt: z.string().datetime()
});

export const POST = withRoleBodyContext(
    Role.PROFESSIONAL,
    confirmSchema,
    async (_req: Request, { user, body }, { params }: { params: Promise<{ id: string }> }) => {
        try {
            const { id } = await params;

            const booking = await ProfessionalRequestService.confirmAndSchedule(
                id,
                user.id,
                new Date(body.startAt)
            );

            return Response.json({ data: booking });
        } catch (error: unknown) {
            console.error('Error confirming booking:', error);
            return jsonHandledError(error, 'Internal Error', 400, 'Validation Error');
        }
    },
    { validationError: 'Validation Error' }
);
