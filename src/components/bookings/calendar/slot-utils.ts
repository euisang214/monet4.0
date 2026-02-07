import { addDays, addMinutes, format } from 'date-fns';
import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';

export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
export const AVAILABILITY_WINDOW_DAYS = 30;
export const WEEK_STARTS_ON = 0; // 0 = Sunday

export type NormalizedSlotInterval = {
    start: Date;
    end: Date;
};

export function startOfSlot(date: Date): Date {
    const next = new Date(date);
    next.setSeconds(0, 0);
    const minutes = next.getMinutes();
    const rounded = minutes < 30 ? 0 : 30;
    next.setMinutes(rounded);
    return next;
}

export function roundUpToNextSlot(date: Date): Date {
    const rounded = startOfSlot(date);
    if (rounded < date) {
        return addMinutes(rounded, SLOT_MINUTES);
    }
    return rounded;
}

export function slotDateForCell(weekStart: Date, dayOffset: number, row: number): Date {
    const date = addDays(weekStart, dayOffset);
    date.setHours(0, 0, 0, 0);
    return addMinutes(date, row * SLOT_MINUTES);
}

export function getSlotLabel(row: number): string {
    if (row % 2 !== 0) return '';

    const labelDate = new Date();
    labelDate.setHours(Math.floor(row / 2), 0, 0, 0);
    return format(labelDate, 'h a');
}

export function normalizeInterval(interval: SlotInput): NormalizedSlotInterval {
    return {
        start: interval.start instanceof Date ? interval.start : new Date(interval.start),
        end: interval.end instanceof Date ? interval.end : new Date(interval.end),
    };
}

export function overlaps(start: Date, end: Date, interval: NormalizedSlotInterval): boolean {
    return interval.start < end && interval.end > start;
}

export function mergeConsecutiveSlots(slotKeys: string[]): SlotInterval[] {
    if (slotKeys.length === 0) return [];

    const sorted = [...slotKeys]
        .map((key) => new Date(key))
        .sort((a, b) => a.getTime() - b.getTime());

    const merged: SlotInterval[] = [];
    let blockStart = sorted[0];
    let blockEnd = addMinutes(sorted[0], SLOT_MINUTES);

    for (let i = 1; i < sorted.length; i++) {
        const currentStart = sorted[i];
        if (currentStart.getTime() === blockEnd.getTime()) {
            blockEnd = addMinutes(currentStart, SLOT_MINUTES);
            continue;
        }

        merged.push({
            start: blockStart.toISOString(),
            end: blockEnd.toISOString(),
        });

        blockStart = currentStart;
        blockEnd = addMinutes(currentStart, SLOT_MINUTES);
    }

    merged.push({
        start: blockStart.toISOString(),
        end: blockEnd.toISOString(),
    });

    return merged;
}
