import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';

export const ReviewsService = {
    async createReview(candidateId: string, data: {
        bookingId: string;
        rating: number;
        text: string;
        timezone: string;
    }) {
        // 1. Verify Booking
        const booking = await prisma.booking.findUnique({
            where: { id: data.bookingId },
        });

        if (!booking) {
            throw new Error("Booking not found");
        }

        // 2. Authorization check
        if (booking.candidateId !== candidateId) {
            throw new Error("Not authorized to review this booking");
        }

        // 3. Status Check (Must be completed)
        if (booking.status !== BookingStatus.completed) {
            throw new Error("Can only review completed bookings");
        }

        // 4. Duplicate Check
        const existing = await prisma.professionalRating.findUnique({
            where: { bookingId: data.bookingId }
        });
        if (existing) {
            throw new Error("Review already exists for this booking");
        }

        // 5. Create
        return await prisma.professionalRating.create({
            data: {
                bookingId: data.bookingId,
                rating: data.rating,
                text: data.text,
                timezone: data.timezone
            }
        });
    },

    /**
     * Get reviews for a professional with aggregated statistics
     * Used by /api/shared/reviews GET
     */
    async getProfessionalReviews(
        professionalId: string,
        options?: {
            take?: number;
        },
    ): Promise<{
        reviews: {
            bookingId: string;
            rating: number;
            text: string | null;
            submittedAt: Date;
            candidateEmail: string | null;
        }[];
        stats: {
            count: number;
            average: number | null;
        };
    }> {
        const where = {
            booking: {
                professionalId,
            },
        };

        const [reviews, aggregate] = await Promise.all([
            prisma.professionalRating.findMany({
                where,
                orderBy: { submittedAt: 'desc' },
                ...(typeof options?.take === 'number' ? { take: options.take } : {}),
                select: {
                    bookingId: true,
                    rating: true,
                    text: true,
                    submittedAt: true,
                    booking: {
                        select: {
                            candidate: {
                                select: {
                                    email: true,
                                },
                            },
                        },
                    },
                },
            }),
            prisma.professionalRating.aggregate({
                where,
                _count: {
                    _all: true,
                },
                _avg: {
                    rating: true,
                },
            }),
        ]);

        const stats = {
            count: aggregate._count._all,
            average: aggregate._avg.rating,
        };

        return {
            reviews: reviews.map((review) => ({
                bookingId: review.bookingId,
                rating: review.rating,
                text: review.text,
                submittedAt: review.submittedAt,
                candidateEmail: review.booking.candidate.email,
            })),
            stats,
        };
    }
};
