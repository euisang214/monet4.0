import { addDays, addMinutes, format, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';

export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
export const AVAILABILITY_WINDOW_DAYS = 30;
export const WEEK_STARTS_ON = 0; // 0 = Sunday
export const VISIBLE_START_HOUR = 8;
export const VISIBLE_END_HOUR = 21;
export const VISIBLE_START_ROW = (VISIBLE_START_HOUR * 60) / SLOT_MINUTES;
export const VISIBLE_END_ROW_EXCLUSIVE = (VISIBLE_END_HOUR * 60) / SLOT_MINUTES;
export const VISIBLE_ROW_COUNT = VISIBLE_END_ROW_EXCLUSIVE - VISIBLE_START_ROW;

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

export function slotDateForCell(weekStart: Date, dayOffset: number, row: number, timeZone?: string): Date {
    if (timeZone) {
        const zonedStart = toZonedTime(weekStart, timeZone);
        zonedStart.setHours(0, 0, 0, 0);
        zonedStart.setDate(zonedStart.getDate() + dayOffset);
        zonedStart.setMinutes(zonedStart.getMinutes() + (row * SLOT_MINUTES));
        return fromZonedTime(zonedStart, timeZone);
    }

    const date = addDays(weekStart, dayOffset);
    date.setHours(0, 0, 0, 0);
    return addMinutes(date, row * SLOT_MINUTES);
}

export function startOfWeekInTimeZone(
    date: Date,
    timeZone: string,
    weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = WEEK_STARTS_ON
): Date {
    const zonedDate = toZonedTime(date, timeZone);
    const zonedWeekStart = startOfWeek(zonedDate, { weekStartsOn });
    zonedWeekStart.setHours(0, 0, 0, 0);
    return fromZonedTime(zonedWeekStart, timeZone);
}

export function addDaysInTimeZone(date: Date, days: number, timeZone: string): Date {
    const zonedDate = toZonedTime(date, timeZone);
    zonedDate.setDate(zonedDate.getDate() + days);
    return fromZonedTime(zonedDate, timeZone);
}

export function getSlotLabel(
    row: number,
    timeZone?: string,
    weekStart?: Date,
    sourceTimeZoneForRow?: string
): string {
    if (row % 2 !== 0) return '';

    if (timeZone && weekStart) {
        const rowAnchorTimeZone = sourceTimeZoneForRow || timeZone;
        return formatInTimeZone(slotDateForCell(weekStart, 0, row, rowAnchorTimeZone), timeZone, 'h a');
    }

    const labelDate = new Date();
    labelDate.setHours(Math.floor(row / 2), 0, 0, 0);
    return format(labelDate, 'h a');
}

export function getDayHeaderLabel(weekStart: Date, dayOffset: number, timeZone?: string): string {
    if (!timeZone) {
        return format(addDays(weekStart, dayOffset), 'EEE MMM d');
    }

    return formatInTimeZone(slotDateForCell(weekStart, dayOffset, 0, timeZone), timeZone, 'EEE MMM d');
}

export function getWeekRangeLabel(weekStart: Date, timeZone?: string): string {
    if (!timeZone) {
        return `${format(weekStart, 'MMM d')} - ${format(addDays(weekStart, 6), 'MMM d')}`;
    }

    const start = formatInTimeZone(slotDateForCell(weekStart, 0, 0, timeZone), timeZone, 'MMM d');
    const end = formatInTimeZone(slotDateForCell(weekStart, 6, 0, timeZone), timeZone, 'MMM d');
    return `${start} - ${end}`;
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
