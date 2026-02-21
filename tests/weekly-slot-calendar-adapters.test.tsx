import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

type UnifiedCalendarMockProps = {
    mode: 'multi-toggle' | 'single-select';
    readOnly?: boolean;
    header: { title: string };
    onSelectionChange?: (payload: { slots: Array<{ start: string; end: string }>; selectedCount: number }) => void;
};

let latestProps: UnifiedCalendarMockProps | null = null;

vi.mock('@/components/bookings/UnifiedWeeklyCalendar', () => ({
    UnifiedWeeklyCalendar: (props: unknown) => {
        const typedProps = props as UnifiedCalendarMockProps;
        latestProps = typedProps;
        return <div data-mode={typedProps.mode} />;
    },
}));

import {
    CandidateWeeklySlotPicker,
    ProfessionalWeeklySlotPicker,
} from '@/components/bookings/WeeklySlotCalendar';

describe('WeeklySlotCalendar adapters', () => {
    beforeEach(() => {
        latestProps = null;
    });

    it('maps candidate adapter payload back to legacy onChange shape', () => {
        const onChange = vi.fn();

        renderToStaticMarkup(
            <CandidateWeeklySlotPicker
                googleBusyIntervals={[]}
                onChange={onChange}
                calendarTimezone="UTC"
                professionalTimezone="America/New_York"
            />
        );

        expect(latestProps).toBeTruthy();
        expect(latestProps.mode).toBe('multi-toggle');

        latestProps.onSelectionChange({
            slots: [{ start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T10:30:00.000Z' }],
            selectedCount: 1,
        });

        expect(onChange).toHaveBeenCalledWith({
            availabilitySlots: [{ start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T10:30:00.000Z' }],
            selectedCount: 1,
        });
    });

    it('maps professional adapter props to single-select mode', () => {
        renderToStaticMarkup(
            <ProfessionalWeeklySlotPicker
                slots={[{ start: '2026-02-24T10:00:00.000Z', end: '2026-02-24T10:30:00.000Z' }]}
                selectedSlot={null}
                readOnly
                calendarTimezone="UTC"
            />
        );

        expect(latestProps).toBeTruthy();
        expect(latestProps.mode).toBe('single-select');
        expect(latestProps.readOnly).toBe(true);
        expect(latestProps.header.title).toBe('Your availability calendar');
    });
});
