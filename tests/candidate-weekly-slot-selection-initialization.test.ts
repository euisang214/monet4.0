import { describe, expect, it } from 'vitest';
import { expandIntervalsToSlotKeys } from '@/components/bookings/hooks/useCandidateWeeklySlotSelection';
import type { SlotInterval } from '@/components/bookings/calendar/types';

describe('expandIntervalsToSlotKeys', () => {
    it('returns an empty list when no initial slots are provided', () => {
        expect(expandIntervalsToSlotKeys([])).toEqual([]);
    });

    it('expands intervals into deduplicated 30-minute slot keys', () => {
        const intervals: SlotInterval[] = [
            { start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' },
            { start: '2026-02-21T10:30:00.000Z', end: '2026-02-21T11:30:00.000Z' },
        ];

        expect(expandIntervalsToSlotKeys(intervals)).toEqual([
            '2026-02-21T10:00:00.000Z',
            '2026-02-21T10:30:00.000Z',
            '2026-02-21T11:00:00.000Z',
        ]);
    });

    it('clamps generated keys to the selectable window', () => {
        const minSelectable = new Date('2026-02-21T10:00:00.000Z');
        const maxSelectable = new Date('2026-02-21T12:00:00.000Z');

        const intervals: SlotInterval[] = [
            { start: '2026-02-21T09:30:00.000Z', end: '2026-02-21T10:30:00.000Z' },
            { start: '2026-02-21T10:30:00.000Z', end: '2026-02-21T11:30:00.000Z' },
            { start: '2026-02-21T11:30:00.000Z', end: '2026-02-21T12:30:00.000Z' },
        ];

        expect(expandIntervalsToSlotKeys(intervals, { minSelectable, maxSelectable })).toEqual([
            '2026-02-21T10:00:00.000Z',
            '2026-02-21T10:30:00.000Z',
            '2026-02-21T11:00:00.000Z',
            '2026-02-21T11:30:00.000Z',
        ]);
    });
});

