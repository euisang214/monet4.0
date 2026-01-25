import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import { ProfessionalEarningsService } from './earnings';
import { ProfessionalFeedbackService } from './feedback';

export const ProfessionalDashboardService = {
    async getDashboardStats(professionalId: string) {
        // Parallel fetch for performace
        const [earnings, pendingFeedback, bookingsCount] = await Promise.all([
            ProfessionalEarningsService.getEarningsSummary(professionalId),
            ProfessionalFeedbackService.getPendingFeedback(professionalId),
            prisma.booking.groupBy({
                by: ['status'],
                where: {
                    professionalId: professionalId
                },
                _count: {
                    _all: true
                }
            })
        ]);

        const stats = {
            totalEarningsCents: earnings.totalEarningsCents,
            pendingPayoutsCents: earnings.pendingPayoutsCents,
            pendingFeedbackCount: pendingFeedback.length,
            totalBookings: bookingsCount.reduce((acc, curr) => acc + curr._count._all, 0),
            upcomingBookingsCount: bookingsCount.find(b => b.status === BookingStatus.accepted)?._count._all || 0,
            completedBookingsCount: bookingsCount.find(b => b.status === BookingStatus.completed)?._count._all || 0
        };

        return stats;
    },

    async getDashboardBookings(professionalId: string) {
        // We need 2 lists:
        // 1. Action Required (Requested)
        // 2. Upcoming (Accepted / Reschedule Pending)

        const [actionRequired, upcoming] = await Promise.all([
            prisma.booking.findMany({
                where: {
                    professionalId,
                    status: BookingStatus.requested
                },
                include: {
                    candidate: {
                        include: {
                            candidateProfile: true
                        }
                    }
                },
                orderBy: {
                    // Booking model in CLAUDE.md does NOT have createdAt.
                    // We use 'startAt' or 'expiresAt' or 'id'.
                    // For requests, they have 'expiresAt'. Newest requests?
                    // ID is slightly correlated with time (cuid), but not strictly.
                    // Best proxy is implicit creation, but without field we can't sort by it.
                    // I'll sort by 'expiresAt' asc? (Expires soonest).
                    expiresAt: 'asc'
                }
            }),
            prisma.booking.findMany({
                where: {
                    professionalId,
                    status: {
                        in: [
                            BookingStatus.accepted,
                            BookingStatus.accepted_pending_integrations,
                            BookingStatus.reschedule_pending
                        ]
                    }
                },
                include: {
                    candidate: true
                },
                orderBy: {
                    startAt: 'asc' // Soonest first
                }
            })
        ]);

        const pendingFeedback = await ProfessionalFeedbackService.getPendingFeedback(professionalId);

        return {
            actionRequired,
            pendingFeedback,
            upcoming
        };
    }
};
