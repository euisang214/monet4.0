import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const requireRoleMock = vi.hoisted(() => vi.fn());
const findUniqueMock = vi.hoisted(() => vi.fn());
const getSavedAvailabilitySeedMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());
const latestClientProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));

vi.mock('@/lib/core/api-helpers', () => ({
    requireRole: requireRoleMock,
}));

vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: {
            findUnique: findUniqueMock,
        },
    },
}));

vi.mock('@/lib/role/candidate/availability', () => ({
    CandidateAvailability: {
        getSavedAvailabilitySeed: getSavedAvailabilitySeedMock,
    },
}));

vi.mock('next/navigation', () => ({
    notFound: notFoundMock,
}));

vi.mock('@/app/candidate/bookings/[id]/reschedule/ReschedulePageClient', () => ({
    ReschedulePageClient: (props: unknown) => {
        latestClientProps.current = props as Record<string, unknown>;
        return <div>mock-reschedule-client</div>;
    },
}));

import ReschedulePage from '@/app/candidate/bookings/[id]/reschedule/page';

describe('Candidate reschedule page preload wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        latestClientProps.current = null;

        requireRoleMock.mockResolvedValue({ id: 'cand-1' });
        findUniqueMock.mockResolvedValue({
            id: 'booking-1',
            candidateId: 'cand-1',
            professional: {
                timezone: 'America/New_York',
            },
            candidate: {
                googleCalendarConnected: false,
                timezone: 'UTC',
            },
        });
        getSavedAvailabilitySeedMock.mockResolvedValue({
            candidateTimezone: 'America/Chicago',
            isGoogleCalendarConnected: true,
            initialAvailabilitySlots: [
                { start: '2026-02-24T16:00:00.000Z', end: '2026-02-24T16:30:00.000Z' },
            ],
        });
    });

    it('passes the saved availability seed into the reschedule client', async () => {
        const page = await ReschedulePage({ params: Promise.resolve({ id: 'booking-1' }) });
        renderToStaticMarkup(page);

        expect(getSavedAvailabilitySeedMock).toHaveBeenCalledWith('cand-1');
        expect(latestClientProps.current).toMatchObject({
            bookingId: 'booking-1',
            calendarTimezone: 'America/Chicago',
            professionalTimezone: 'America/New_York',
            isGoogleCalendarConnected: true,
            initialAvailabilitySlots: [
                { start: '2026-02-24T16:00:00.000Z', end: '2026-02-24T16:30:00.000Z' },
            ],
        });
    });
});
