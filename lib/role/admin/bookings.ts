import { prisma } from '@/lib/core/db';

export interface BookingFilters {
    query?: string;
}

export const AdminBookingService = {
    /**
     * Lists bookings with optional filters.
     */
    async listBookings(filters?: BookingFilters, limit: number = 50) {
        const where: Record<string, unknown> = {};

        if (filters?.query) {
            where.OR = [
                { id: { contains: filters.query, mode: 'insensitive' } },
            ];
        }

        return await prisma.booking.findMany({
            where,
            include: {
                payment: true,
            },
            orderBy: {
                startAt: 'desc',
            },
            take: limit,
        });
    },

    /**
     * Gets a single booking by ID with full details.
     */
    async getBookingById(bookingId: string) {
        return await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: true,
                feedback: true,
                payout: true,
            },
        });
    }
};
