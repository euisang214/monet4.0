import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const useCandidateGoogleBusyMock = vi.hoisted(() => vi.fn());

let latestPickerOnChange:
    | ((payload: { availabilitySlots: Array<{ start: string; end: string }>; selectedCount: number }) => void)
    | null = null;

vi.mock('@/components/bookings/hooks/useCandidateGoogleBusy', () => ({
    useCandidateGoogleBusy: (...args: unknown[]) => useCandidateGoogleBusyMock(...args),
}));

vi.mock('@/components/bookings/WeeklySlotCalendar', () => ({
    CandidateWeeklySlotPicker: (props: unknown) => {
        const typedProps = props as {
            onChange: (payload: { availabilitySlots: Array<{ start: string; end: string }>; selectedCount: number }) => void;
        };
        latestPickerOnChange = typedProps.onChange;
        return <div>mock-weekly-picker</div>;
    },
}));

import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';

describe('CandidateAvailabilityPanel', () => {
    beforeEach(() => {
        useCandidateGoogleBusyMock.mockReset();
        useCandidateGoogleBusyMock.mockReturnValue({
            googleBusyIntervals: [],
            isLoadingBusy: true,
            busyLoadError: 'calendar warning',
            lastBusyRefreshAt: new Date('2026-02-21T10:00:00.000Z'),
            refreshGoogleBusy: vi.fn(),
        });
        latestPickerOnChange = null;
    });

    it('renders refresh UI, busy warning, and initial selected count', () => {
        const html = renderToStaticMarkup(
            <CandidateAvailabilityPanel
                calendarTimezone="UTC"
                isGoogleCalendarConnected
                initialSelectedSlots={[{ start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' }]}
                onSelectionChange={() => {}}
            />
        );

        expect(html).toContain('Refreshing calendar...');
        expect(html).toContain('calendar warning');
        expect(html).toContain('Selected candidate slots');
        expect(html).toContain('2');
        expect(html).toContain('mock-weekly-picker');
    });

    it('forwards selection payload from picker', () => {
        const onSelectionChange = vi.fn();

        renderToStaticMarkup(
            <CandidateAvailabilityPanel
                calendarTimezone="UTC"
                isGoogleCalendarConnected
                onSelectionChange={onSelectionChange}
            />
        );

        expect(latestPickerOnChange).toBeTruthy();

        latestPickerOnChange?.({
            availabilitySlots: [{ start: '2026-02-21T12:00:00.000Z', end: '2026-02-21T12:30:00.000Z' }],
            selectedCount: 1,
        });

        expect(onSelectionChange).toHaveBeenCalledWith({
            availabilitySlots: [{ start: '2026-02-21T12:00:00.000Z', end: '2026-02-21T12:30:00.000Z' }],
            selectedCount: 1,
        });
    });

    it('disables refresh when Google Calendar is not connected', () => {
        useCandidateGoogleBusyMock.mockReturnValue({
            googleBusyIntervals: [],
            isLoadingBusy: false,
            busyLoadError: null,
            lastBusyRefreshAt: null,
            refreshGoogleBusy: vi.fn(),
        });

        const html = renderToStaticMarkup(
            <CandidateAvailabilityPanel
                calendarTimezone="UTC"
                isGoogleCalendarConnected={false}
                onSelectionChange={() => {}}
            />
        );

        expect(useCandidateGoogleBusyMock).toHaveBeenCalledWith({ autoLoad: false });
        expect(html).toMatch(/<button[^>]*disabled[^>]*>Refresh Google Calendar<\/button>/);
    });
});
