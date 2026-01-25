import { auth } from '@/auth';
import { checkRateLimit } from '@/lib/core/rate-limit';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { CreateBookingRequestSchema } from '@/lib/types/booking-schemas';
import { Role } from '@prisma/client';

export async function POST(request: Request) {
    const session = await auth();
    // Rate limit check: 5 requests per minute for booking creation
    const isAllowed = await checkRateLimit(session?.user?.id, 5, 60000);
    if (!isAllowed) {
        return Response.json({ error: 'too_many_requests' }, { status: 429 });
    }

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.CANDIDATE) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const parsed = CreateBookingRequestSchema.safeParse(body);

        if (!parsed.success) {
            return Response.json({ error: 'validation_error', details: parsed.error }, { status: 400 });
        }

        const { booking, clientSecret, stripePaymentIntentId } = await CandidateBookings.requestBooking(
            session.user.id,
            parsed.data
        );

        return Response.json({
            data: {
                bookingId: booking.id,
                clientSecret,
                stripePaymentIntentId
            }
        });
    } catch (error: any) {
        console.error('Booking request error:', error);
        return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
    }
}
