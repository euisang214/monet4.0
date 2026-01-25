import { prisma } from '@/lib/core/db';
import { Availability } from '@prisma/client';

export const CandidateSettings = {
    getAvailability: async (userId: string) => {
        return await prisma.availability.findMany({
            where: { userId },
            orderBy: { start: 'asc' }
        });
    },

    updateAvailability: async (userId: string, availability: Omit<Availability, 'id' | 'userId'>[]) => {
        // Replace all availability for simplicity (or upsert if needed)
        // Transaction to ensure atomic replacement
        return await prisma.$transaction(async (tx) => {
            await tx.availability.deleteMany({ where: { userId } });

            if (availability.length > 0) {
                await tx.availability.createMany({
                    data: availability.map(a => ({
                        userId,
                        start: a.start,
                        end: a.end,
                        busy: a.busy,
                        timezone: a.timezone
                    }))
                });
            }

            return await tx.availability.findMany({ where: { userId } });
        });
    },

    getGoogleCalendarStatus: async (userId: string) => {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { googleCalendarConnected: true }
        });
        return user?.googleCalendarConnected || false;
    }
};
