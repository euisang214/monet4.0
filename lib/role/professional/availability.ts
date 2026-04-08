import { AvailabilityService } from '@/lib/domain/availability/service';

export const ProfessionalAvailability = {
    getBusyTimes: async (professionalId: string) => {
        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + 30);

        return AvailabilityService.getUserBusyTimes(professionalId, start, end);
    },
};
