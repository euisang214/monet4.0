import { NextRequest } from 'next/server';
import { withRole } from '@/lib/core/api-helpers';
import { z } from 'zod';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { Role } from '@prisma/client';

import { auth } from '@/auth';

export const GET = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const slots = await ProfessionalRequestService.getBookingCandidateAvailability(
            params.id,
            session.user.id
        );
        return Response.json({ data: slots });
    } catch (error: any) {
        console.error('Error fetching availability:', error);
        return Response.json({ error: error.message || 'Internal Error' }, { status: 400 });
    }
});

const confirmSchema = z.object({
    startAt: z.string().datetime()
});

export const POST = withRole(Role.PROFESSIONAL, async (req: Request, { params }: { params: { id: string } }) => {
    try {
        const session = await auth();
        if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { startAt } = confirmSchema.parse(body);

        const booking = await ProfessionalRequestService.confirmAndSchedule(
            params.id,
            session.user.id,
            new Date(startAt)
        );

        return Response.json({ data: booking });
    } catch (error: any) {
        console.error('Error confirming booking:', error);
        if (error instanceof z.ZodError) {
            return Response.json({ error: 'Validation Error', details: error.issues }, { status: 400 });
        }
        return Response.json({ error: error.message || 'Internal Error' }, { status: 400 });
    }
});
