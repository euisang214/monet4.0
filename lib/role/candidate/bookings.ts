import { createBookingRequest, requestReschedule as transitionReschedule, initiateDispute as transitionDispute, cancelBooking as transitionCancel } from '@/lib/domain/bookings/transitions';
import { CreateBookingRequestInput } from '@/lib/types/booking-schemas';
import { Role } from '@prisma/client';
import { ReviewsService } from '@/lib/domain/reviews/service';
import { AvailabilityService } from '@/lib/shared/availability';

export const CandidateBookings = {
    requestBooking: async (candidateId: string, data: CreateBookingRequestInput) => {
        if (data.availabilitySlots.length > 0) {
            await AvailabilityService.replaceUserAvailability(
                candidateId,
                data.availabilitySlots.map((slot) => ({
                    start: slot.start,
                    end: slot.end,
                    busy: false,
                })),
                data.timezone || 'UTC'
            );
        }

        return createBookingRequest(candidateId, data.professionalId, data.weeks);
    },

    requestReschedule: async (
        candidateId: string,
        bookingId: string,
        slots: { start: Date; end: Date }[],
        reason?: string,
        timezone: string = 'UTC'
    ) => {
        if (slots.length > 0) {
            await AvailabilityService.replaceUserAvailability(
                candidateId,
                slots.map((slot) => ({
                    start: slot.start.toISOString(),
                    end: slot.end.toISOString(),
                    busy: false,
                })),
                timezone
            );
        }

        return transitionReschedule(bookingId, { userId: candidateId, role: Role.CANDIDATE }, slots, reason);
    },

    initiateDispute: async (candidateId: string, bookingId: string, reason: string, description: string) => {
        return transitionDispute(bookingId, { userId: candidateId, role: Role.CANDIDATE }, reason, description);
    },

    cancelBooking: async (candidateId: string, bookingId: string, reason?: string) => {
        return transitionCancel(bookingId, { userId: candidateId, role: Role.CANDIDATE }, reason);
    },

    submitReview: async (candidateId: string, data: { bookingId: string; rating: number; text: string; timezone: string }) => {
        return ReviewsService.createReview(candidateId, data);
    }
};
