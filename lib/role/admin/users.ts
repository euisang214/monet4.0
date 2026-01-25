import { prisma } from '@/lib/core/db';

export const AdminUserService = {
    /**
     * Lists users with pagination.
     */
    async listUsers(limit: number = 100, offset: number = 0) {
        return await prisma.user.findMany({
            orderBy: { email: 'asc' },
            take: limit,
            skip: offset,
        });
    },

    /**
     * Gets a single user by ID.
     */
    async getUserById(userId: string) {
        return await prisma.user.findUnique({
            where: { id: userId },
        });
    }
};
