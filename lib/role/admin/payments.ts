import { prisma } from '@/lib/core/db';

export const AdminPaymentService = {
    /**
     * Lists payments with booking relations.
     */
    async listPayments(limit: number = 50) {
        return await prisma.payment.findMany({
            include: {
                booking: true,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }
};
