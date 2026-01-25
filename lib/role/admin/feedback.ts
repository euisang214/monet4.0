import { prisma } from '@/lib/core/db';

export const AdminFeedbackService = {
    /**
     * Lists feedback entries.
     */
    async listFeedback(limit: number = 50) {
        return await prisma.callFeedback.findMany({
            orderBy: { submittedAt: 'desc' },
            take: limit,
        });
    }
};
