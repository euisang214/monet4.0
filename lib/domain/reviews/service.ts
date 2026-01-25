import { prisma } from '@/lib/core/db';
import { BookingStatus, Role } from '@prisma/client';

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
    async getProfessionalReviews(professionalId: string): Promise<{
        reviews: {
            bookingId: string;
            rating: number;
            text: string | null;
            submittedAt: Date;
        }[];
        stats: {
            count: number;
            average: number | null;
        };
    }> {
        const reviews = await prisma.professionalRating.findMany({
            where: {
                booking: {
                    professionalId,
                },
            },
            orderBy: { submittedAt: 'desc' },
            select: {
                bookingId: true,
                rating: true,
                text: true,
                submittedAt: true,
            },
        });

        const stats = {
            count: reviews.length,
            average: reviews.length > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
                : null,
        };

        return { reviews, stats };
    }
};
