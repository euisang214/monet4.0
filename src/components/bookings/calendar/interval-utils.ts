import type { SlotInterval } from '@/components/bookings/calendar/types';
import { SLOT_MINUTES, normalizeInterval } from '@/components/bookings/calendar/slot-utils';

type IntervalDate = {
    start: Date;
    end: Date;
};

function normalizeAndSortIntervals(slots: SlotInterval[]): IntervalDate[] {
    return slots
        .map((slot) => normalizeInterval(slot))
        .filter((slot) => slot.end > slot.start)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function toSlotInterval(interval: IntervalDate): SlotInterval {
    return {
        start: interval.start.toISOString(),
        end: interval.end.toISOString(),
    };
}

export function mergeSlotIntervals(slots: SlotInterval[]): SlotInterval[] {
    if (slots.length === 0) return [];

    const sorted = normalizeAndSortIntervals(slots);
    if (sorted.length === 0) return [];

    const merged: IntervalDate[] = [{ ...sorted[0] }];
    for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index];
        const previous = merged[merged.length - 1];

        if (current.start.getTime() <= previous.end.getTime()) {
            previous.end = new Date(Math.max(previous.end.getTime(), current.end.getTime()));
            continue;
        }

        merged.push({ ...current });
    }

    return merged.map(toSlotInterval);
}

export function splitSlotsByEditableWindow(
    slots: SlotInterval[],
    editableStart: Date,
    editableEnd: Date
): { editableSlots: SlotInterval[]; preservedSlots: SlotInterval[] } {
    const editableSlots: SlotInterval[] = [];
    const preservedSlots: SlotInterval[] = [];

    for (const interval of normalizeAndSortIntervals(slots)) {
        if (interval.end <= editableStart) {
            continue;
        }

        if (interval.start < editableEnd && interval.end > editableStart) {
            editableSlots.push({
                start: new Date(Math.max(interval.start.getTime(), editableStart.getTime())).toISOString(),
                end: new Date(Math.min(interval.end.getTime(), editableEnd.getTime())).toISOString(),
            });
        }

        if (interval.end > editableEnd) {
            preservedSlots.push({
                start: new Date(Math.max(interval.start.getTime(), editableEnd.getTime())).toISOString(),
                end: interval.end.toISOString(),
            });
        }
    }

    return {
        editableSlots: mergeSlotIntervals(editableSlots),
        preservedSlots: mergeSlotIntervals(preservedSlots),
    };
}

function slotSerializationKey(slots: SlotInterval[]): string {
    return mergeSlotIntervals(slots)
        .map((slot) => `${slot.start}|${slot.end}`)
        .join(',');
}

export function areSlotIntervalsEqual(left: SlotInterval[], right: SlotInterval[]): boolean {
    return slotSerializationKey(left) === slotSerializationKey(right);
}

export function countHalfHourSlots(slots: SlotInterval[]): number {
    const slotMs = SLOT_MINUTES * 60 * 1000;

    return mergeSlotIntervals(slots).reduce((total, interval) => {
        const normalized = normalizeInterval(interval);
        return total + Math.max(0, Math.round((normalized.end.getTime() - normalized.start.getTime()) / slotMs));
    }, 0);
}

export interface BuildAvailabilitySavePayloadArgs {
    selectedEditableSlots: SlotInterval[];
    baselineSlots: SlotInterval[];
    editableStart: Date;
    editableEnd: Date;
    timezone: string;
}

export function buildAvailabilitySavePayload({
    selectedEditableSlots,
    baselineSlots,
    editableStart,
    editableEnd,
    timezone,
}: BuildAvailabilitySavePayloadArgs): { slots: SlotInterval[]; timezone: string } {
    const { preservedSlots } = splitSlotsByEditableWindow(baselineSlots, editableStart, editableEnd);
    const editableSlots = splitSlotsByEditableWindow(selectedEditableSlots, editableStart, editableEnd).editableSlots;

    return {
        slots: mergeSlotIntervals([...editableSlots, ...preservedSlots]),
        timezone,
    };
}

