import { AvailabilityService } from '@/lib/shared/availability';

export const CandidateAvailability = {
    getBusyTimes: async (candidateId: string) => {
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30); // Default 30 days window as per CLAUDE.md

        return await AvailabilityService.getCandidateBusyTimes(candidateId, start, end);
    },

    setAvailability: async (candidateId: string, slots: any[]) => {
        return await AvailabilityService.setAvailability(candidateId, slots);
    }
};
