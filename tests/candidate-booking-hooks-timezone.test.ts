import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import {
    createCandidateBookingRequest,
    submitCandidateRescheduleRequest,
} from '@/components/bookings/services/candidateBookingApi';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, ok = true) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(payload),
    } as unknown as Response;
}

describe('candidate booking/reschedule payload timezone wiring', () => {
    const slots: SlotInterval[] = [
        { start: '2026-02-21T17:00:00.000Z', end: '2026-02-21T18:00:00.000Z' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
    });

    it('uses the provided timezone for booking request payloads', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            data: {
                bookingId: 'booking-1',
                clientSecret: 'secret-1',
            },
        }));

        await createCandidateBookingRequest({
            professionalId: 'pro-1',
            availabilitySlots: slots,
            timezone: 'America/Chicago',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    availabilitySlots: slots,
                    timezone: 'America/Chicago',
                }),
            }),
        );
    });

    it('uses the provided timezone for reschedule request payloads', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}));

        await submitCandidateRescheduleRequest({
            bookingId: 'book-1',
            slots,
            reason: 'Conflict',
            timezone: 'America/Chicago',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    slots,
                    reason: 'Conflict',
                    timezone: 'America/Chicago',
                }),
            }),
        );
    });
});
