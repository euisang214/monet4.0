import { createBookingRequest, requestReschedule as transitionReschedule, initiateDispute as transitionDispute, cancelBooking as transitionCancel } from '@/lib/domain/bookings/transitions';
import { CreateBookingRequestInput } from '@/lib/types/booking-schemas';
import { Role } from '@prisma/client';
import { ReviewsService } from '@/lib/domain/reviews/service';

export const CandidateBookings = {
    requestBooking: async (candidateId: string, data: CreateBookingRequestInput) => {
        return createBookingRequest(candidateId, data.professionalId, data.weeks);
    },

    requestReschedule: async (candidateId: string, bookingId: string, slots: { start: Date; end: Date }[], reason?: string) => {
        return transitionReschedule(bookingId, { userId: candidateId, role: Role.CANDIDATE }, slots, reason);
    },

    initiateDispute: async (candidateId: string, bookingId: string, reason: string, description: string) => {
        return transitionDispute(bookingId, { userId: candidateId, role: Role.CANDIDATE }, reason, description);
    },

    cancelBooking: async (candidateId: string, bookingId: string, reason?: string) => {
        return transitionCancel(bookingId, { userId: candidateId, role: Role.CANDIDATE }, reason);
    },

    submitReview: async (candidateId: string, data: any) => {
        return ReviewsService.createReview(candidateId, data);
    }
};
