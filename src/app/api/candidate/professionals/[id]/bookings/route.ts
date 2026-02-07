import { auth } from '@/auth';
import { checkRateLimit } from '@/lib/core/rate-limit';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { CreateBookingRequestSchema } from '@/lib/types/booking-schemas';
import { Role } from '@prisma/client';

const CreateBookingBodySchema = CreateBookingRequestSchema.omit({
    professionalId: true,
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: professionalId } = await params;
    const session = await auth();

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
        const parsedBody = CreateBookingBodySchema.safeParse(body);

        if (!parsedBody.success) {
            return Response.json({ error: 'validation_error', details: parsedBody.error }, { status: 400 });
        }

        const { booking, clientSecret, stripePaymentIntentId } = await CandidateBookings.requestBooking(
            session.user.id,
            {
                ...parsedBody.data,
                professionalId,
            }
        );

        return Response.json({
            data: {
                bookingId: booking.id,
                clientSecret,
                stripePaymentIntentId,
            },
        });
    } catch (error: unknown) {
        console.error('Booking request error:', error);
        const message = error instanceof Error ? error.message : 'internal_error';
        return Response.json({ error: message }, { status: 500 });
    }
}
