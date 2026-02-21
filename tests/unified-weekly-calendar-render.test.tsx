import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnifiedWeeklyCalendar } from '@/components/bookings/UnifiedWeeklyCalendar';

describe('UnifiedWeeklyCalendar', () => {
    it('renders multi-toggle mode with candidate header, legends, and counterpart timezone axis', () => {
        const html = renderToStaticMarkup(
            <UnifiedWeeklyCalendar
                mode="multi-toggle"
                calendarTimezone="UTC"
                counterpartTimezone="America/New_York"
                googleBusyIntervals={[]}
                onSelectionChange={() => {}}
                header={{
                    title: 'Select Availability',
                    description: 'Toggle slots',
                }}
            />
        );

        expect(html).toContain('Select Availability');
        expect(html).toContain('Toggle slots');
        expect(html).toContain('Busy on Google Calendar');
        expect(html).toContain('America/New_York');
    });

    it('renders single-select mode with selection legends', () => {
        const html = renderToStaticMarkup(
            <UnifiedWeeklyCalendar
                mode="single-select"
                calendarTimezone="UTC"
                selectableSlots={[
                    { start: '2026-02-24T10:00:00.000Z', end: '2026-02-24T11:00:00.000Z' },
                ]}
                selectedSlot={null}
                onSelect={() => {}}
                header={{ title: 'Choose slot' }}
            />
        );

        expect(html).toContain('Choose slot');
        expect(html).toContain('Can choose');
        expect(html).toContain('Selected slot');
        expect(html).toContain('Unavailable');
    });

    it('renders single-select read-only mode with read-only legend', () => {
        const html = renderToStaticMarkup(
            <UnifiedWeeklyCalendar
                mode="single-select"
                calendarTimezone="UTC"
                selectableSlots={[
                    { start: '2026-02-24T10:00:00.000Z', end: '2026-02-24T11:00:00.000Z' },
                ]}
                selectedSlot={null}
                readOnly
                header={{ title: 'Read only' }}
            />
        );

        expect(html).toContain('Read only');
        expect(html).toContain('Available');
        expect(html).not.toContain('Selected slot');
    });
});

