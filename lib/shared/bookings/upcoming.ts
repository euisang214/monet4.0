import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import { signCandidateResumeUrls } from '@/lib/shared/resume-signing';

/**
 * Upcoming Booking Queries
 * 
 * Shared utility for fetching upcoming bookings for dashboards.
 */

type UpcomingBookingsOptions = {
    limit?: number;
};

const DEFAULT_LIMIT = 10;

/**
 * Get upcoming bookings for a user (accepted, pending states)
 */
export async function getUpcomingBookings(
    userId: string,
    role: 'CANDIDATE' | 'PROFESSIONAL',
    options: UpcomingBookingsOptions = {}
) {
    const { limit = DEFAULT_LIMIT } = options;

    const whereClause = role === 'CANDIDATE'
        ? { candidateId: userId }
        : { professionalId: userId };

    const bookings = await prisma.booking.findMany({
        where: {
            ...whereClause,
            status: {
                in: [
                    BookingStatus.accepted,
                    BookingStatus.accepted_pending_integrations,
                    BookingStatus.reschedule_pending,
                    BookingStatus.completed_pending_feedback,
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
        },
        orderBy: { startAt: 'asc' },
        take: limit,
    });

    await signCandidateResumeUrls(bookings);

    return bookings;
}

/**
 * Get pending requests for a user (awaiting action)
 */
export async function getPendingRequests(
    userId: string,
    role: 'CANDIDATE' | 'PROFESSIONAL',
    options: UpcomingBookingsOptions = {}
) {
    const { limit = DEFAULT_LIMIT } = options;

    const whereClause = role === 'CANDIDATE'
        ? { candidateId: userId }
        : { professionalId: userId };

    const bookings = await prisma.booking.findMany({
        where: {
            ...whereClause,
            ...(role === 'PROFESSIONAL'
                ? {
                    status: {
                        in: [BookingStatus.requested, BookingStatus.reschedule_pending],
                    },
                }
                : { status: BookingStatus.requested }),
        },
        include: {
            candidate: {
                include: { candidateProfile: true },
            },
            professional: {
                include: { professionalProfile: true },
            },
            payment: true,
        },
        orderBy: role === 'PROFESSIONAL'
            ? [{ status: 'asc' }, { expiresAt: 'asc' }]
            : { expiresAt: 'asc' }, // Expires soonest first
        take: limit,
    });

    await signCandidateResumeUrls(bookings);

    return bookings;
}
