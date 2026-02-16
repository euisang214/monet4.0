import { describe, expect, it } from 'vitest';
import {
    VISIBLE_START_ROW,
    getDayHeaderLabel,
    getSlotLabel,
    getWeekRangeLabel,
} from '@/components/bookings/calendar/slot-utils';

describe('slot-utils timezone helpers', () => {
    it('formats day headers against the provided calendar timezone', () => {
        const weekStart = new Date('2026-01-05T01:00:00.000Z');

        expect(getDayHeaderLabel(weekStart, 0, 'UTC')).toBe('Mon Jan 5');
        expect(getDayHeaderLabel(weekStart, 0, 'America/Los_Angeles')).toBe('Sun Jan 4');
    });

    it('can format a row marker in a secondary timezone using the calendar timezone row anchor', () => {
        const weekStart = new Date('2026-01-05T00:00:00.000Z');

        expect(getSlotLabel(VISIBLE_START_ROW, 'UTC', weekStart, 'UTC')).toBe('8 AM');
        expect(getSlotLabel(VISIBLE_START_ROW, 'America/New_York', weekStart, 'UTC')).toBe('3 AM');
        expect(getSlotLabel(VISIBLE_START_ROW, 'America/New_York', weekStart)).toBe('8 AM');
    });

    it('formats week range labels in the selected timezone', () => {
        const weekStart = new Date('2026-01-05T01:00:00.000Z');

        expect(getWeekRangeLabel(weekStart, 'UTC')).toBe('Jan 5 - Jan 11');
        expect(getWeekRangeLabel(weekStart, 'America/Los_Angeles')).toBe('Jan 4 - Jan 10');
    });
});
