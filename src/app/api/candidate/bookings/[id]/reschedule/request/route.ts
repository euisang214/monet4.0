import { auth } from '@/auth';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { Role } from '@prisma/client';
import { z } from 'zod';

const RescheduleSchema = z.object({
    slots: z.array(z.object({
        start: z.coerce.date(),
        end: z.coerce.date()
    })).min(1),
    reason: z.string().optional()
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.CANDIDATE) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const parsed = RescheduleSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: 'validation_error' }, { status: 400 });
        }

        await CandidateBookings.requestReschedule(session.user.id, id, parsed.data.slots, parsed.data.reason);
        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Reschedule error:', error);
        return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
    }
}
