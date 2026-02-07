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
                    status: {
                        in: [BookingStatus.requested, BookingStatus.reschedule_pending]
                    }
                },
                include: {
                    candidate: {
                        include: {
                            candidateProfile: true
                        }
                    }
                },
                orderBy: {
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
