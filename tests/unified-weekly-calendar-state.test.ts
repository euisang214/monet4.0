import { describe, expect, it } from 'vitest';
import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import {
    expandIntervalsToSlotKeys,
    getProfessionalWeekBounds,
} from '@/components/bookings/hooks/useUnifiedWeeklyCalendarState';

describe('useUnifiedWeeklyCalendarState helpers', () => {
    it('expands intervals into deduplicated 30-minute keys with selectable-window clamping', () => {
        const intervals: SlotInterval[] = [
            { start: '2026-02-21T09:30:00.000Z', end: '2026-02-21T10:30:00.000Z' },
            { start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' },
        ];

        const keys = expandIntervalsToSlotKeys(intervals, {
            minSelectable: new Date('2026-02-21T10:00:00.000Z'),
            maxSelectable: new Date('2026-02-21T11:00:00.000Z'),
        });

        expect(keys).toEqual([
            '2026-02-21T10:00:00.000Z',
            '2026-02-21T10:30:00.000Z',
        ]);
    });

    it('returns professional week bounds from slot data and null when empty', () => {
        const emptyBounds = getProfessionalWeekBounds([], 'UTC');
        expect(emptyBounds).toBeNull();

        const slots: SlotInput[] = [
            { start: '2026-02-23T09:00:00.000Z', end: '2026-02-23T09:30:00.000Z' },
            { start: '2026-03-03T10:00:00.000Z', end: '2026-03-03T10:30:00.000Z' },
        ];
        const bounds = getProfessionalWeekBounds(slots, 'UTC');
        expect(bounds).not.toBeNull();
        expect(bounds?.minWeekStart.toISOString()).toBe('2026-02-22T00:00:00.000Z');
        expect(bounds?.maxWeekStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });
});

