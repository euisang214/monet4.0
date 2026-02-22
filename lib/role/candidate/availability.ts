import { AvailabilityService } from '@/lib/domain/availability/service';
import { prisma } from '@/lib/core/db';

export type SavedAvailabilitySeed = {
    candidateTimezone: string;
    initialAvailabilitySlots: Array<{ start: string; end: string }>;
};

export const CandidateAvailability = {
    getBusyTimes: async (candidateId: string) => {
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30); // Default 30 days window as per CLAUDE.md

        return await AvailabilityService.getCandidateBusyTimes(candidateId, start, end);
    },

    setAvailability: async (candidateId: string, slots: any[]) => {
        return await AvailabilityService.setAvailability(candidateId, slots);
    },

    getSavedAvailabilitySeed: async (candidateId: string): Promise<SavedAvailabilitySeed> => {
        const now = new Date();

        const [candidate, availability] = await Promise.all([
            prisma.user.findUnique({
                where: { id: candidateId },
                select: { timezone: true },
            }),
            AvailabilityService.getUserAvailability(candidateId),
        ]);

        const initialAvailabilitySlots = availability
            .filter((slot) => !slot.busy)
            .filter((slot) => slot.end > now)
            .map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }))
            .sort((a, b) => a.start.localeCompare(b.start));

        return {
            candidateTimezone: candidate?.timezone || 'UTC',
            initialAvailabilitySlots,
        };
    },
};
