import { describe, expect, it } from 'vitest';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { buildCandidateBookingRequestPayload } from '@/components/bookings/hooks/useCandidateBookingRequest';
import { buildCandidateRescheduleRequestPayload } from '@/components/bookings/hooks/useCandidateRescheduleRequest';

describe('candidate booking/reschedule payload timezone wiring', () => {
    const slots: SlotInterval[] = [
        { start: '2026-02-21T17:00:00.000Z', end: '2026-02-21T18:00:00.000Z' },
    ];

    it('uses the provided timezone for booking request payloads', () => {
        const payload = buildCandidateBookingRequestPayload({
            professionalId: 'pro-1',
            availabilitySlots: slots,
            timezone: 'America/Chicago',
        });

        expect(payload.timezone).toBe('America/Chicago');
        expect(payload.availabilitySlots).toEqual(slots);
    });

    it('uses the provided timezone for reschedule request payloads', () => {
        const payload = buildCandidateRescheduleRequestPayload({
            bookingId: 'book-1',
            slots,
            reason: 'Conflict',
            timezone: 'America/Chicago',
        });

        expect(payload.timezone).toBe('America/Chicago');
        expect(payload.slots).toEqual(slots);
    });
});
