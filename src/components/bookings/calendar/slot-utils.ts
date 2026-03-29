import { addDays, addMinutes, format, startOfWeek } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import {
    doesTimeRangeOverlap,
    mergeTimeRanges,
    normalizeTimeRange,
    type DateTimeRange,
} from '@/lib/shared/time-intervals';

export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
export const AVAILABILITY_WINDOW_DAYS = 30;
export const WEEK_STARTS_ON = 0; // 0 = Sunday
export const VISIBLE_START_HOUR = 8;
export const VISIBLE_END_HOUR = 23;
export const VISIBLE_START_ROW = (VISIBLE_START_HOUR * 60) / SLOT_MINUTES;
export const VISIBLE_END_ROW_EXCLUSIVE = (VISIBLE_END_HOUR * 60) / SLOT_MINUTES;
export const VISIBLE_ROW_COUNT = VISIBLE_END_ROW_EXCLUSIVE - VISIBLE_START_ROW;

export type NormalizedSlotInterval = DateTimeRange;

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
    return normalizeTimeRange(interval);
}

export function overlaps(start: Date, end: Date, interval: NormalizedSlotInterval): boolean {
    return doesTimeRangeOverlap(start, end, interval);
}

export function mergeConsecutiveSlots(slotKeys: string[]): SlotInterval[] {
    if (slotKeys.length === 0) return [];

    return mergeTimeRanges(
        slotKeys.map((key) => {
            const start = new Date(key);
            return {
                start,
                end: addMinutes(start, SLOT_MINUTES),
            };
        }),
    ).map((range) => ({
        start: range.start.toISOString(),
        end: range.end.toISOString(),
    }));
}
