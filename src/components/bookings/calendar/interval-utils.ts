import type { SlotInterval } from '@/components/bookings/calendar/types';
import { SLOT_MINUTES } from '@/components/bookings/calendar/slot-utils';
import {
    areSerializedTimeRangesEqual,
    countTimeRangeSteps,
    serializeTimeRanges,
    splitTimeRangesByWindow,
} from '@/lib/shared/time-intervals';

export function mergeSlotIntervals(slots: SlotInterval[]): SlotInterval[] {
    return serializeTimeRanges(slots);
}

export function splitSlotsByEditableWindow(
    slots: SlotInterval[],
    editableStart: Date,
    editableEnd: Date
): { editableSlots: SlotInterval[]; preservedSlots: SlotInterval[] } {
    const { editableRanges, preservedRanges } = splitTimeRangesByWindow(slots, editableStart, editableEnd);

    return {
        editableSlots: serializeTimeRanges(editableRanges),
        preservedSlots: serializeTimeRanges(preservedRanges),
    };
}

export function areSlotIntervalsEqual(left: SlotInterval[], right: SlotInterval[]): boolean {
    return areSerializedTimeRangesEqual(left, right);
}

export function countHalfHourSlots(slots: SlotInterval[]): number {
    return countTimeRangeSteps(slots, SLOT_MINUTES);
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
