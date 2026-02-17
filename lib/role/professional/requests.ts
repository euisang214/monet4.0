import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { getGoogleBusyTimes } from '@/lib/integrations/calendar/google';
import { stripe } from '@/lib/integrations/stripe';
import {
    acceptBookingWithIntegrations,
    declineBooking
} from '@/lib/domain/bookings/transitions';
import { bookingsQueue } from '@/lib/queues';
import { addMinutes, isBefore, isAfter, areIntervalsOverlapping } from 'date-fns';
import { TransitionConflictError, TransitionError } from '@/lib/domain/bookings/errors';

export const ProfessionalRequestService = {
    /**
     * Calculates available time slots for a candidate for a specific booking.
     * Merging logic: (Positive Availability - Manual Blocks - Google Busy)
     */
    async getBookingCandidateAvailability(bookingId: string, professionalId: string) {
        // 1. Fetch booking to get candidateId
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { candidate: true }
        });

        if (!booking) throw new Error('Booking not found');
        if (booking.professionalId !== professionalId) throw new Error('Unauthorized');

        const candidateId = booking.candidateId;
        // Define search window (e.g., next 30 days)
        const startWindow = new Date();
        const endWindow = new Date();
        endWindow.setDate(endWindow.getDate() + 30);

        // 2. Fetch Positive Availability (busy=false)
        // These are the "Working Hours" defined by the candidate
        const workingHours = await prisma.availability.findMany({
            where: {
                userId: candidateId,
                busy: false,
                start: { gte: startWindow },
                end: { lte: endWindow }
            }
        });

        // 3. Fetch Manual Blocks (busy=true)
        const manualBlocks = await prisma.availability.findMany({
            where: {
                userId: candidateId,
                busy: true,
                start: { gte: startWindow },
                end: { lte: endWindow }
            }
        });

        // 4. Fetch Google Busy Times
        let googleBusy: { start: Date; end: Date }[] = [];
        try {
            googleBusy = await getGoogleBusyTimes(candidateId, startWindow, endWindow);
        } catch (error) {
            console.error('Failed to fetch Google busy times', error);
            // Non-blocking fail, proceed with internal data only
        }

        // 5. Combine all blocks
        const allBlocks = [...manualBlocks, ...googleBusy];

        // 6. Subtract blocks from working hours to generate final slots
        // This is a simplified slot generator (30 min slots)
        const slots: { start: Date; end: Date }[] = [];
        const SLOT_DURATION_MINUTES = 30;

        // If no working hours defined, assume NO availability (strict opt-in)
        // Alternatively we could assume 9-5 M-F if array is empty, but strict is safer.
        if (workingHours.length === 0) {
            return [];
        }

        for (const window of workingHours) {
            let current = new Date(window.start);
            const windowEnd = new Date(window.end);

            while (isBefore(current, windowEnd)) {
                const slotEnd = addMinutes(current, SLOT_DURATION_MINUTES);

                if (isAfter(slotEnd, windowEnd)) break;

                // Check overlap with any block
                const isBlocked = allBlocks.some(block =>
                    areIntervalsOverlapping(
                        { start: current, end: slotEnd },
                        { start: block.start, end: block.end }
                    )
                );

                if (!isBlocked) {
                    slots.push({ start: new Date(current), end: new Date(slotEnd) });
                }

                current = addMinutes(current, SLOT_DURATION_MINUTES);
            }
        }

        return slots;
    },

    /**
     * Confirms the booking, capturing payment and starting integration jobs.
     */
    async confirmAndSchedule(bookingId: string, professionalId: string, startAt: Date) {
        // 1. Fetch booking to check status and get paymentIntentId
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true }
        });

        if (!booking) throw new Error('Booking not found');
        if (booking.professionalId !== professionalId) throw new TransitionError('Unauthorized');

        const expectedEndAt = addMinutes(startAt, 30);
        const sameRequestedWindow = booking.startAt?.getTime() === startAt.getTime()
            && booking.endAt?.getTime() === expectedEndAt.getTime();

        if (booking.status === 'accepted_pending_integrations' || booking.status === 'accepted') {
            if (sameRequestedWindow) {
                return booking;
            }
            throw new TransitionConflictError('Booking has already been scheduled with a different time');
        }

        if (booking.status !== 'requested') throw new TransitionError('Booking not in requested state');

        if (!booking.payment?.stripePaymentIntentId) {
            throw new Error('No payment intent found for booking');
        }

        // 2. Capture Payment (Fail Fast)
        try {
            await stripe.paymentIntents.capture(booking.payment.stripePaymentIntentId);
        } catch (error: unknown) {
            console.error('Stripe capture failed:', error);
            // We rethrow as a 400-friendly error or let the specific Stripe error bubble
            // If the error is "PaymentIntent cannot be captured because it has a status of canceled", handle gracefully?
            const message = error instanceof Error ? error.message : 'Unknown Stripe capture error';
            throw new Error(`Payment capture failed: ${message}`);
        }

        // 3. Transition State (DB Update)
        // This sets status to 'accepted_pending_integrations' and payment to 'held'
        await acceptBookingWithIntegrations(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL }
        );

        // 4. Update Booking with Schedule Time
        // We do this separately or update the transition function to accept time.
        // The current transition `acceptBookingWithIntegrations` doesn't take time.
        // So we update it manually here within the flow, or ideally, add it to the transition.
        // Given we are outside the transaction of the transition, there's a tiny gap, 
        // but arguably 'accepted_pending_integrations' implies we are setting it up.
        // Let's update the time.
        const scheduledBooking = await prisma.booking.update({
            where: { id: bookingId },
            data: {
                startAt: startAt,
                endAt: expectedEndAt // Hardcoded 30 mins per CLAUDE.md
            }
        });

        // 5. Trigger Background Job for Integrations (Zoom, Calendar)
        await bookingsQueue.add('confirm-booking', { bookingId }, {
            jobId: `confirm-${bookingId}` // Idempotency key
        });

        return scheduledBooking;
    },

    /**
     * Declines a booking request.
     */
    async declineBooking(bookingId: string, professionalId: string, reason?: string) {
        return declineBooking(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL },
            reason || 'No reason provided'
        );
    }
};
