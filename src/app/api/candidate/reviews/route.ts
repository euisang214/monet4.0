import { auth } from '@/auth';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { Role } from '@prisma/client';
import { z } from 'zod';

const ReviewSchema = z.object({
    bookingId: z.string().cuid(),
    rating: z.number().min(1).max(5),
    text: z.string().min(50),
    timezone: z.string()
});

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.CANDIDATE) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const parsed = ReviewSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: 'validation_error' }, { status: 400 });
        }

        await CandidateBookings.submitReview(session.user.id, parsed.data);
        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Review error:', error);
        return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
    }
}
