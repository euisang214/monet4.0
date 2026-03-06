import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
    booking: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    availability: {
        findMany: vi.fn(),
    },
}));

vi.mock('@/lib/core/db', () => ({
    prisma: mockPrisma,
}));

vi.mock('@/lib/integrations/stripe', () => ({
    stripe: {
        paymentIntents: {
            capture: vi.fn(),
        },
    },
}));

vi.mock('@/lib/domain/bookings/transitions', () => ({
    acceptBookingWithIntegrations: vi.fn(),
    declineBooking: vi.fn(),
}));

vi.mock('@/lib/queues', () => ({
    bookingsQueue: {
        add: vi.fn(),
    },
}));

import { ProfessionalRequestService } from '@/lib/role/professional/requests';

describe('ProfessionalRequestService.getBookingCandidateAvailability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-03-06T12:00:00.000Z'));

        mockPrisma.booking.findUnique.mockResolvedValue({
            id: 'booking-1',
            candidateId: 'cand-1',
            professionalId: 'pro-1',
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns candidate-submitted availability as 30-minute slots', async () => {
        mockPrisma.availability.findMany
            .mockResolvedValueOnce([
                {
                    start: new Date('2026-03-07T15:00:00.000Z'),
                    end: new Date('2026-03-07T16:00:00.000Z'),
                },
            ])
            .mockResolvedValueOnce([]);

        const slots = await ProfessionalRequestService.getBookingCandidateAvailability('booking-1', 'pro-1');

        expect(slots).toEqual([
            {
                start: new Date('2026-03-07T15:00:00.000Z'),
                end: new Date('2026-03-07T15:30:00.000Z'),
            },
            {
                start: new Date('2026-03-07T15:30:00.000Z'),
                end: new Date('2026-03-07T16:00:00.000Z'),
            },
        ]);
    });

    it('subtracts explicit busy rows from candidate-submitted availability', async () => {
        mockPrisma.availability.findMany
            .mockResolvedValueOnce([
                {
                    start: new Date('2026-03-08T15:00:00.000Z'),
                    end: new Date('2026-03-08T16:30:00.000Z'),
                },
            ])
            .mockResolvedValueOnce([
                {
                    start: new Date('2026-03-08T15:30:00.000Z'),
                    end: new Date('2026-03-08T16:00:00.000Z'),
                },
            ]);

        const slots = await ProfessionalRequestService.getBookingCandidateAvailability('booking-1', 'pro-1');

        expect(slots).toEqual([
            {
                start: new Date('2026-03-08T15:00:00.000Z'),
                end: new Date('2026-03-08T15:30:00.000Z'),
            },
            {
                start: new Date('2026-03-08T16:00:00.000Z'),
                end: new Date('2026-03-08T16:30:00.000Z'),
            },
        ]);
    });

    it('keeps a candidate-submitted slot that may have originated from a Google-busy override', async () => {
        mockPrisma.availability.findMany
            .mockResolvedValueOnce([
                {
                    start: new Date('2026-03-09T15:00:00.000Z'),
                    end: new Date('2026-03-09T15:30:00.000Z'),
                },
            ])
            .mockResolvedValueOnce([]);

        const slots = await ProfessionalRequestService.getBookingCandidateAvailability('booking-1', 'pro-1');

        expect(slots).toEqual([
            {
                start: new Date('2026-03-09T15:00:00.000Z'),
                end: new Date('2026-03-09T15:30:00.000Z'),
            },
        ]);
    });
});
