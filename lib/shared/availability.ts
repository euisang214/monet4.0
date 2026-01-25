import { prisma } from '@/lib/core/db';
import { getGoogleBusyTimes } from '@/lib/integrations/calendar/google';
import { Availability } from '@prisma/client';

export const AvailabilityService = {
    /**
     * Gets merged busy times for a candidate from Google Calendar and Manual Availability exceptions.
     * Note: "Availability" model stores *availability* or *busy*?
     * schema.prisma: `busy Boolean @default(false)`
     * If `busy` is true, it's a blocked slot.
     * If `busy` is false, it's an available slot?
     * CLAUDE.md #783: "busy Boolean @default(false) // true = blocked, false = available"
     * 
     * However, the request is for "Busy Times".
     * So we want all slots where busy=true OR Google Calendar is busy.
     * 
     * Wait, usually Availability tables store "Available Slots" (white list) or "Overrides"?
     * CLAUDE.md: "Availability ... Synced from Google Calendar busy times and manual preferences."
     * Line 1096: "Fetches 30 days of busy times, merges with manual availability"
     * 
     * So we return a list of { start, end } that are BUSY.
     */
    async getCandidateBusyTimes(userId: string, start: Date, end: Date) {
        // 1. Fetch Google Calendar Busy Times
        const googleBusy = await getGoogleBusyTimes(userId, start, end);

        // 2. Fetch Manual Busy Times (from DB)
        const dbBusy = await prisma.availability.findMany({
            where: {
                userId,
                start: { gte: start },
                end: { lte: end },
                busy: true
            },
            select: { start: true, end: true }
        });

        // 3. Merge (Simple concatenation, client can merge overlaps if needed, or we do it here)
        // We'll just return raw list for now.
        return [...googleBusy, ...dbBusy];
    },

    /**
     * Set manual availability preferences.
     * Upserts slots.
     */
    async setAvailability(userId: string, slots: { start: Date; end: Date; busy: boolean }[]) {
        // This might be complex if we need to replace existing?
        // Simple implementation: Create new ones. 
        // Real implementation would be better.
        // For now we just implement the facade support.

        await prisma.$transaction(
            slots.map(slot => prisma.availability.create({
                data: {
                    userId,
                    start: slot.start,
                    end: slot.end,
                    busy: slot.busy
                }
            }))
        );
    },

    /**
     * Get user's future availability slots
     * Used by /api/candidate/availability GET
     */
    async getUserAvailability(userId: string): Promise<Availability[]> {
        return prisma.availability.findMany({
            where: {
                userId,
                start: { gte: new Date() },
            },
            orderBy: { start: 'asc' },
        });
    },

    /**
     * Replace all future availability slots for a user
     * Implements delete + create pattern used by /api/candidate/availability POST
     * @param userId - The user to update
     * @param slots - New slots to create
     * @param timezone - Timezone for all slots
     */
    async replaceUserAvailability(
        userId: string,
        slots: { start: string; end: string; busy?: boolean }[],
        timezone: string = 'UTC'
    ): Promise<{ success: boolean }> {
        await prisma.$transaction(async (tx) => {
            // 1. Delete all future manual availability
            await tx.availability.deleteMany({
                where: {
                    userId,
                    start: { gte: new Date() },
                },
            });

            // 2. Create new slots if provided
            if (slots.length > 0) {
                await tx.availability.createMany({
                    data: slots.map(slot => ({
                        userId,
                        start: new Date(slot.start),
                        end: new Date(slot.end),
                        busy: slot.busy ?? false,
                        timezone,
                    })),
                });
            }
        });

        return { success: true };
    }
};
