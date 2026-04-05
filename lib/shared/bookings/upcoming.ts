import { prisma } from '@/lib/core/db';
import { BookingStatus, Prisma } from '@prisma/client';
import { formatCandidateForProfessionalView } from '@/lib/domain/users/identity-labels';
import { appRoutes } from '@/lib/shared/routes';

/**
 * Upcoming Booking Queries
 * 
 * Shared utility for fetching upcoming bookings for dashboards.
 */

type UpcomingBookingsOptions = {
    limit?: number;
};

const DEFAULT_LIMIT = 10;

const candidateDescriptorSelect = {
    firstName: true,
    lastName: true,
    candidateProfile: {
        select: {
            resumeUrl: true,
            experience: {
                where: { type: 'EXPERIENCE' },
                orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                take: 1,
                select: {
                    id: true,
                    title: true,
                    company: true,
                    startDate: true,
                    endDate: true,
                    isCurrent: true,
                },
            },
            education: {
                orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                take: 1,
                select: {
                    id: true,
                    school: true,
                    startDate: true,
                    endDate: true,
                    isCurrent: true,
                },
            },
        },
    },
} satisfies Prisma.UserSelect;

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
        select: {
            id: true,
            status: true,
            priceCents: true,
            startAt: true,
            endAt: true,
            expiresAt: true,
            zoomJoinUrl: true,
            candidateZoomJoinUrl: true,
            candidate: {
                select: candidateDescriptorSelect,
            },
            professional: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    professionalProfile: true,
                },
            },
        },
        orderBy: { startAt: 'asc' },
        take: limit,
    });

    if (role === 'PROFESSIONAL') {
        return bookings.map((booking) => ({
            ...booking,
            candidateLabel: formatCandidateForProfessionalView({
                firstName: booking.candidate.firstName,
                lastName: booking.candidate.lastName,
                experience: booking.candidate.candidateProfile?.experience,
                education: booking.candidate.candidateProfile?.education,
            }),
        }));
    }

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
        select: {
            id: true,
            status: true,
            priceCents: true,
            expiresAt: true,
            candidate: {
                select: candidateDescriptorSelect,
            },
        },
        orderBy: role === 'PROFESSIONAL'
            ? [{ status: 'asc' }, { expiresAt: 'asc' }]
            : { expiresAt: 'asc' }, // Expires soonest first
        take: limit,
    });

    if (role === 'PROFESSIONAL') {
        return bookings.map((booking) => ({
            ...booking,
            candidateLabel: formatCandidateForProfessionalView({
                firstName: booking.candidate.firstName,
                lastName: booking.candidate.lastName,
                experience: booking.candidate.candidateProfile?.experience,
                education: booking.candidate.candidateProfile?.education,
            }),
            resumeHref: booking.candidate.candidateProfile?.resumeUrl
                ? appRoutes.api.professional.requestResume(booking.id)
                : null,
        }));
    }

    return bookings;
}
