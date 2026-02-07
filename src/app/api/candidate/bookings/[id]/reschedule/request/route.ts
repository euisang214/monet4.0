import { auth } from '@/auth';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { Role } from '@prisma/client';
import { z } from 'zod';

const RescheduleSchema = z.object({
    slots: z.array(z.object({
        start: z.coerce.date(),
        end: z.coerce.date()
    })).min(1),
    reason: z.string().optional(),
    timezone: z.string().optional(),
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

        await CandidateBookings.requestReschedule(
            session.user.id,
            id,
            parsed.data.slots,
            parsed.data.reason,
            parsed.data.timezone || 'UTC'
        );
        return Response.json({ success: true });
    } catch (error: unknown) {
        console.error('Reschedule error:', error);
        if (error instanceof Error) {
            return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
        }
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
