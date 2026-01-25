import { prisma } from '@/lib/core/db';

export async function getCandidateBookings(userId: string) {
    const bookings = await prisma.booking.findMany({
        where: {
            candidateId: userId,
        },
        include: {
            professional: {
                include: {
                    professionalProfile: true,
                },
            },
            payment: true,
        },
        orderBy: {
            id: 'desc',
        },
    });

    return bookings;
}

export async function getBookingDetails(bookingId: string, userId: string) {
    const booking = await prisma.booking.findUnique({
        where: {
            id: bookingId,
            candidateId: userId, // Ensure ownership
        },
        include: {
            professional: {
                include: {
                    professionalProfile: true,
                },
            },
            payment: true,
            // We might need more details later, e.g. feedback/reviews if enabling "Leave Review" check
        },
    });

    return booking;
}
