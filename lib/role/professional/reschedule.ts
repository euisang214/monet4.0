import { prisma } from '@/lib/core/db';
import { Role, BookingStatus } from '@prisma/client';
import {
    requestReschedule,
    confirmReschedule,
    rejectReschedule
} from '@/lib/domain/bookings/transitions';
import { bookingsQueue } from '@/lib/queues';
import { ProfessionalRequestService } from './requests';
import { addMinutes } from 'date-fns';
import { TransitionConflictError } from '@/lib/domain/bookings/errors';

export const ProfessionalRescheduleService = {
    /**
     * Submit a professional proposal round.
     */
    async requestReschedule(
        bookingId: string,
        professionalId: string,
        slots: { start: Date; end: Date }[],
        reason?: string
    ) {
        return requestReschedule(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL },
            slots,
            reason
        );
    },

    /**
     * Get candidate availability for rescheduling.
     * Mirrors the initial booking availability logic.
     */
    async getRescheduleAvailability(bookingId: string, professionalId: string) {
        return ProfessionalRequestService.getBookingCandidateAvailability(bookingId, professionalId);
    },

    /**
     * Confirm a new time.
     * Deletes old Zoom, creates new one via Job.
     */
    async confirmReschedule(bookingId: string, professionalId: string, startAt: Date) {
        // 1. Fetch current booking to get OLD Zoom ID before transition (though transition doesn't wipe it)
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId }
        });

        if (!booking) throw new Error('Booking not found');

        const endAt = addMinutes(startAt, 30); // 30 min duration
        const sameRequestedWindow = booking.startAt?.getTime() === startAt.getTime()
            && booking.endAt?.getTime() === endAt.getTime();

        // Early idempotency check at the service layer to avoid unnecessary
        // DB transactions and queue jobs. The domain layer (confirmReschedule)
        // performs the same check inside the transaction for safety.
        if (booking.status === BookingStatus.accepted && sameRequestedWindow) {
            return booking;
        }

        if (booking.status === BookingStatus.accepted) {
            const availableSlots = await ProfessionalRequestService.getBookingCandidateAvailability(bookingId, professionalId);
            const isAllowedSlot = availableSlots.some((slot) =>
                slot.start.getTime() === startAt.getTime() && slot.end.getTime() === endAt.getTime()
            );

            if (!isAllowedSlot) {
                throw new TransitionConflictError('Selected time is no longer in the candidate’s current availability');
            }
        }

        const oldZoomMeetingId = booking.zoomMeetingId;

        // 2. Transition State (Updates Status -> Accepted, Updates startAt/endAt)
        const updatedBooking = await confirmReschedule(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL },
            startAt,
            endAt
        );

        // 3. Queue Job to swap Zoom
        await bookingsQueue.add('reschedule-booking', {
            bookingId,
            oldZoomMeetingId
        }, {
            jobId: `reschedule-${bookingId}-${startAt.toISOString()}` // Deterministic key for duplicate retries
        });

        return updatedBooking;
    },

    /**
     * Reject a reschedule request.
     * Triggers cancellation.
     */
    async rejectReschedule(bookingId: string, professionalId: string) {
        return rejectReschedule(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL }
        );
    }
};
