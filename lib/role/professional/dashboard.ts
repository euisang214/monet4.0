import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import { ProfessionalFeedbackService } from './feedback';
import { ReviewsService } from '@/lib/domain/reviews/service';
import { createResumeUrlSigner } from '@/lib/integrations/resume-storage';

type BookingWithCandidateResume = {
    candidate: {
        candidateProfile?: {
            resumeUrl?: string | null;
        } | null;
    };
};

async function signActionRequiredResumeUrls(bookings: BookingWithCandidateResume[]) {
    const signResumeUrl = createResumeUrlSigner();

    await Promise.all(
        bookings.map(async (booking) => {
            const candidateProfile = booking.candidate.candidateProfile;
            if (!candidateProfile?.resumeUrl) return;

            candidateProfile.resumeUrl = (await signResumeUrl(candidateProfile.resumeUrl)) ?? null;
        })
    );
}

export const ProfessionalDashboardService = {
    async getDashboardStats(professionalId: string) {
        const [pendingFeedback, bookingsCount] = await Promise.all([
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
            pendingFeedbackCount: pendingFeedback.length,
            totalBookings: bookingsCount.reduce((acc, curr) => acc + curr._count._all, 0),
            upcomingBookingsCount: bookingsCount.find(b => b.status === BookingStatus.accepted)?._count._all || 0,
            completedBookingsCount: bookingsCount.find(b => b.status === BookingStatus.completed)?._count._all || 0
        };

        return stats;
    },

    async getDashboardBookings(professionalId: string) {
        const [actionRequired, upcoming, pendingFeedback, recentFeedbackData] = await Promise.all([
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
                    status: BookingStatus.accepted
                },
                select: {
                    id: true,
                    startAt: true,
                    timezone: true,
                    zoomJoinUrl: true,
                    candidate: {
                        select: {
                            email: true
                        }
                    }
                },
                orderBy: {
                    startAt: 'asc' // Soonest first
                }
            }),
            ProfessionalFeedbackService.getPendingFeedback(professionalId),
            ReviewsService.getProfessionalReviews(professionalId, { take: 5 }),
        ]);

        await signActionRequiredResumeUrls(actionRequired);

        return {
            actionRequired,
            pendingFeedback,
            upcoming,
            recentFeedback: recentFeedbackData.reviews,
            reviewStats: recentFeedbackData.stats,
        };
    }
};
