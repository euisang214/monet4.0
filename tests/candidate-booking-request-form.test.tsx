import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const submitRequestMock = vi.hoisted(() => vi.fn());
const latestPanelProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PaymentElement: () => <div>payment-element</div>,
    useElements: () => null,
    useStripe: () => null,
}));

vi.mock('@/components/bookings/hooks/useCandidateBookingRequest', () => ({
    useCandidateBookingRequest: () => ({
        clientSecret: null,
        bookingId: null,
        isSubmitting: false,
        error: null,
        submitRequest: submitRequestMock,
    }),
}));

vi.mock('@/components/bookings/CandidateAvailabilityPanel', () => ({
    CandidateAvailabilityPanel: (props: unknown) => {
        latestPanelProps.current = props as Record<string, unknown>;
        return <div>mock-availability-panel</div>;
    },
}));

import { CandidateBookingRequestForm } from '@/components/bookings/CandidateBookingRequestForm';

describe('CandidateBookingRequestForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        latestPanelProps.current = null;
    });

    it('forwards preloaded initial availability to the availability panel', () => {
        const initialSlots = [
            { start: '2026-02-22T16:00:00.000Z', end: '2026-02-22T16:30:00.000Z' },
            { start: '2026-02-23T18:00:00.000Z', end: '2026-02-23T18:30:00.000Z' },
        ];

        renderToStaticMarkup(
            <CandidateBookingRequestForm
                professionalId="pro-1"
                priceCents={25000}
                candidateTimezone="America/Chicago"
                professionalTimezone="America/New_York"
                initialAvailabilitySlots={initialSlots}
            />
        );

        expect(latestPanelProps.current).toMatchObject({
            initialSelectedSlots: initialSlots,
            calendarTimezone: 'America/Chicago',
            professionalTimezone: 'America/New_York',
        });
    });
});
