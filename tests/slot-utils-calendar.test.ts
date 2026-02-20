import { describe, expect, it } from 'vitest';
import {
    VISIBLE_START_ROW,
    addDaysInTimeZone,
    getDayHeaderLabel,
    getSlotLabel,
    getWeekRangeLabel,
    startOfWeekInTimeZone,
} from '@/components/bookings/calendar/slot-utils';
import { getProfessionalWeekBounds } from '@/components/bookings/hooks/useProfessionalWeeklySlotSelection';

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

    it('computes start of week in a target timezone independent of runtime locale', () => {
        const slotStart = new Date('2026-02-21T17:00:00.000Z');

        expect(startOfWeekInTimeZone(slotStart, 'America/Chicago').toISOString()).toBe('2026-02-15T06:00:00.000Z');
        expect(startOfWeekInTimeZone(slotStart, 'America/Los_Angeles').toISOString()).toBe('2026-02-15T08:00:00.000Z');
    });

    it('moves week navigation by timezone-safe local days', () => {
        const weekStart = new Date('2026-02-15T06:00:00.000Z'); // Sun Feb 15 in America/Chicago

        expect(addDaysInTimeZone(weekStart, 7, 'America/Chicago').toISOString()).toBe('2026-02-22T06:00:00.000Z');
        expect(addDaysInTimeZone(weekStart, -7, 'America/Chicago').toISOString()).toBe('2026-02-08T06:00:00.000Z');
    });

    it('keeps professional picker week bounds aligned to calendar timezone', () => {
        const bounds = getProfessionalWeekBounds(
            [{ start: '2026-02-21T17:00:00.000Z', end: '2026-02-21T21:00:00.000Z' }],
            'America/Chicago'
        );

        expect(bounds).not.toBeNull();
        expect(bounds?.minWeekStart.toISOString()).toBe('2026-02-15T06:00:00.000Z');
        expect(bounds?.maxWeekStart.toISOString()).toBe('2026-02-15T06:00:00.000Z');
        expect(getWeekRangeLabel(bounds!.minWeekStart, 'America/Chicago')).toBe('Feb 15 - Feb 21');
    });
});
