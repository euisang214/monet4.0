import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const requireRoleMock = vi.hoisted(() => vi.fn());
const getProfessionalDetailsMock = vi.hoisted(() => vi.fn());
const getSavedAvailabilitySeedMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() => vi.fn());
const latestFormProps = vi.hoisted(() => ({ current: null as null | Record<string, unknown> }));

vi.mock('@/lib/core/api-helpers', () => ({
    requireRole: requireRoleMock,
}));

vi.mock('@/lib/role/candidate/browse', () => ({
    CandidateBrowse: {
        getProfessionalDetails: getProfessionalDetailsMock,
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

vi.mock('@/components/bookings/CandidateBookingRequestForm', () => ({
    CandidateBookingRequestForm: (props: unknown) => {
        latestFormProps.current = props as Record<string, unknown>;
        return <div>mock-booking-form</div>;
    },
}));

import BookingRequestPage from '@/app/candidate/professionals/[id]/book/page';

describe('BookingRequestPage preload wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        latestFormProps.current = null;

        requireRoleMock.mockResolvedValue({ id: 'cand-1' });
        getProfessionalDetailsMock.mockResolvedValue({
            title: 'Staff Engineer',
            employer: 'Acme',
            priceCents: 25000,
            timezone: 'America/New_York',
            isRedacted: false,
            user: {
                firstName: 'Taylor',
                lastName: 'Smith',
            },
        });
        getSavedAvailabilitySeedMock.mockResolvedValue({
            candidateTimezone: 'America/Chicago',
            initialAvailabilitySlots: [
                { start: '2026-02-22T16:00:00.000Z', end: '2026-02-22T16:30:00.000Z' },
            ],
        });
    });

    it('passes saved availability seed into the booking form', async () => {
        const page = await BookingRequestPage({ params: Promise.resolve({ id: 'pro-1' }) });
        renderToStaticMarkup(page);

        expect(getProfessionalDetailsMock).toHaveBeenCalledWith('pro-1', 'cand-1');
        expect(getSavedAvailabilitySeedMock).toHaveBeenCalledWith('cand-1');
        expect(latestFormProps.current).toMatchObject({
            professionalId: 'pro-1',
            professionalTimezone: 'America/New_York',
            priceCents: 25000,
            candidateTimezone: 'America/Chicago',
            initialAvailabilitySlots: [
                { start: '2026-02-22T16:00:00.000Z', end: '2026-02-22T16:30:00.000Z' },
            ],
        });
    });
});
