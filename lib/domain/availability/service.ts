import { prisma } from '@/lib/core/db';
import { getGoogleBusyTimes } from '@/lib/integrations/calendar/google';
import { isBefore, max, min } from 'date-fns';
import { subtractIntervalFromSlots } from '@/lib/shared/time-slot';
import { Availability } from '@prisma/client';

export const AvailabilityService = {
    /**
     * Gets merged busy times for a candidate from Google Calendar and manual busy blocks.
     */
    async getCandidateBusyTimes(userId: string, start: Date, end: Date) {
        const googleBusy = await getGoogleBusyTimes(userId, start, end);

        const dbBusy = await prisma.availability.findMany({
            where: {
                userId,
                start: { gte: start },
                end: { lte: end },
                busy: true,
            },
            select: { start: true, end: true },
        });

        return [...googleBusy, ...dbBusy];
    },

    /**
     * Sets manual availability preferences by creating slots.
     */
    async setAvailability(userId: string, slots: { start: Date; end: Date; busy: boolean }[]) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { timezone: true },
        });
        const canonicalTimezone = user?.timezone || 'UTC';

        await prisma.$transaction(
            slots.map((slot) => prisma.availability.create({
                data: {
                    userId,
                    start: slot.start,
                    end: slot.end,
                    busy: slot.busy,
                    timezone: canonicalTimezone,
                },
            }))
        );
    },

    /**
     * Gets future availability rows for a user.
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
     * Replaces all future availability slots for a user.
     */
    async replaceUserAvailability(
        userId: string,
        slots: { start: string; end: string; busy?: boolean }[],
        requestTimezone?: string
    ): Promise<{ success: boolean }> {
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { timezone: true },
            });

            if (!user) {
                throw new Error('User not found');
            }
            if (requestTimezone && requestTimezone !== user.timezone) {
                console.warn(
                    `[AvailabilityService] Ignoring request timezone "${requestTimezone}" for user ${userId}; using canonical "${user.timezone}".`
                );
            }

            await tx.availability.deleteMany({
                where: {
                    userId,
                    start: { gte: new Date() },
                },
            });

            if (slots.length > 0) {
                await tx.availability.createMany({
                    data: slots.map((slot) => ({
                        userId,
                        start: new Date(slot.start),
                        end: new Date(slot.end),
                        busy: slot.busy ?? false,
                        timezone: user.timezone,
                    })),
                });
            }
        });

        return { success: true };
    },

    /**
     * Calculates combined availability using manual availability minus internal and Google busy intervals.
     */
    async getCombinedAvailability(
        userId: string,
        start: Date,
        end: Date
    ): Promise<{ start: Date; end: Date }[]> {
        const [manualAvailability, existingBookings, googleBusyTimes] = await Promise.all([
            prisma.availability.findMany({
                where: {
                    userId,
                    busy: false,
                    start: { lt: end },
                    end: { gt: start },
                },
                orderBy: { start: 'asc' },
            }),
            prisma.booking.findMany({
                where: {
                    OR: [{ professionalId: userId }, { candidateId: userId }],
                    status: {
                        in: ['accepted', 'accepted_pending_integrations', 'completed_pending_feedback'],
                    },
                    startAt: { not: null, lt: end },
                    endAt: { not: null, gt: start },
                },
            }),
            getGoogleBusyTimes(userId, start, end),
        ]);

        const busyIntervals: { start: Date; end: Date }[] = [
            ...existingBookings.map((booking) => ({ start: booking.startAt!, end: booking.endAt! })),
            ...googleBusyTimes,
        ];

        let availableSlots: { start: Date; end: Date }[] = manualAvailability.map((slot) => ({
            start: slot.start,
            end: slot.end,
        }));

        for (const busy of busyIntervals) {
            availableSlots = subtractIntervalFromSlots(availableSlots, busy);
        }

        return availableSlots
            .map((slot) => ({
                start: max([slot.start, start]),
                end: min([slot.end, end]),
            }))
            .filter((slot) => isBefore(slot.start, slot.end));
    },
};
