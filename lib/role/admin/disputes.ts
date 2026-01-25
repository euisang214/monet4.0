import { prisma } from '@/lib/core/db';

export const AdminDisputeService = {
    /**
     * Lists disputes with relations.
     */
    async listDisputes() {
        return await prisma.dispute.findMany({
            include: {
                initiator: true,
                booking: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    },

    /**
     * Gets a single dispute by ID.
     */
    async getDisputeById(disputeId: string) {
        return await prisma.dispute.findUnique({
            where: { id: disputeId },
            include: {
                initiator: true,
                booking: {
                    include: {
                        payment: true,
                    },
                },
            },
        });
    }
};
