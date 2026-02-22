import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import { signCandidateResumeUrls } from '@/lib/shared/resume-signing';

/**
 * Booking History Queries
 * 
 * Shared utility for fetching historical bookings for dashboards.
 */

type BookingHistoryOptions = {
    limit?: number;
    cursor?: string;
};

const DEFAULT_LIMIT = 20;

/**
 * Get booking history for a user (completed, cancelled, refunded bookings)
 */
export async function getBookingHistory(
    userId: string,
    role: 'CANDIDATE' | 'PROFESSIONAL',
    options: BookingHistoryOptions = {}
) {
    const { limit = DEFAULT_LIMIT, cursor } = options;

    const whereClause = role === 'CANDIDATE'
        ? { candidateId: userId }
        : { professionalId: userId };

    const bookings = await prisma.booking.findMany({
        where: {
            ...whereClause,
            status: {
                in: [
                    BookingStatus.completed,
                    BookingStatus.cancelled,
                    BookingStatus.refunded,
                    BookingStatus.declined,
                    BookingStatus.expired,
                ],
            },
        },
        include: {
            candidate: {
                include: { candidateProfile: true },
            },
            professional: {
                include: { professionalProfile: true },
            },
            payment: true,
            feedback: true,
        },
        orderBy: { id: 'desc' },
        take: limit + 1, // Fetch one extra for cursor-based pagination
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    await signCandidateResumeUrls(bookings);

    const hasMore = bookings.length > limit;
    const items = hasMore ? bookings.slice(0, limit) : bookings;
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

    return {
        bookings: items,
        nextCursor,
    };
}
