import { auth } from '@/auth';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
// import { ProfessionalBookings } from '@/lib/role/professional/bookings'; // Not implementing pro yet
import { Role } from '@prisma/client';
import { z } from 'zod';
import { cancelBooking as transitionCancel } from '@/lib/domain/bookings/transitions';
import { getErrorMessage, getErrorStatus } from '@/lib/core/api-helpers';

const CancelSchema = z.object({
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

    try {
        const body = await request.json();
        const parsed = CancelSchema.safeParse(body);
        if (!parsed.success) {
            return Response.json({ error: 'validation_error' }, { status: 400 });
        }

        if (session.user.role === Role.CANDIDATE) {
            await CandidateBookings.cancelBooking(session.user.id, id, parsed.data.reason);
        } else if (session.user.role === Role.PROFESSIONAL) {
            // Direct transition call for now as strict role facade might not be ready
            await transitionCancel(id, { userId: session.user.id, role: Role.PROFESSIONAL }, parsed.data.reason);
        } else {
            return Response.json({ error: 'forbidden' }, { status: 403 });
        }

        return Response.json({ success: true });
    } catch (error: unknown) {
        console.error('Cancel error:', error);
        const status = getErrorStatus(error, 400);
        const message = getErrorMessage(error, 'internal_error');
        return Response.json({ error: message }, { status });
    }
}
