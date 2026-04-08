import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const latestPanelProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        back: vi.fn(),
    }),
}));

vi.mock('@/components/bookings/hooks/useTrackedCandidateBookingActions', () => ({
    useTrackedCandidateBookingActions: () => ({
        submitRescheduleRequest: vi.fn(),
    }),
}));

vi.mock('@/components/bookings/CandidateAvailabilityPanel', () => ({
    CandidateAvailabilityPanel: (props: unknown) => {
        latestPanelProps.current = props as Record<string, unknown>;
        return <div>mock-availability-panel</div>;
    },
}));

import { ReschedulePageClient } from '@/app/candidate/bookings/[id]/reschedule/ReschedulePageClient';

describe('ReschedulePageClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        latestPanelProps.current = null;
    });

    it('forwards preloaded availability into the candidate availability panel', () => {
        const initialSlots = [
            { start: '2026-02-24T16:00:00.000Z', end: '2026-02-24T16:30:00.000Z' },
            { start: '2026-02-25T18:00:00.000Z', end: '2026-02-25T18:30:00.000Z' },
        ];

        renderToStaticMarkup(
            <ReschedulePageClient
                bookingId="booking-1"
                calendarTimezone="America/Chicago"
                professionalTimezone="America/New_York"
                isGoogleCalendarConnected
                initialAvailabilitySlots={initialSlots}
            />
        );

        expect(latestPanelProps.current).toMatchObject({
            initialSelectedSlots: initialSlots,
            calendarTimezone: 'America/Chicago',
            professionalTimezone: 'America/New_York',
            isGoogleCalendarConnected: true,
        });
    });
});
