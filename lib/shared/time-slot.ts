import { areIntervalsOverlapping, isBefore } from 'date-fns';

/**
 * Time Slot Utilities
 * 
 * Consolidated time-slot logic for availability manipulation.
 * lib/domain/shared/availability.ts imports from here.
 */

export type TimeSlot = {
    start: Date;
    end: Date;
    timezone?: string;
};

/**
 * Subtracts a busy interval from a list of available slots.
 * Returns a new list of available slots with the busy time removed.
 * 
 * Moved from lib/domain/shared/availability.ts
 */
export function subtractIntervalFromSlots(
    currentSlots: TimeSlot[],
    busy: TimeSlot
): TimeSlot[] {
    const result: TimeSlot[] = [];

    for (const slot of currentSlots) {
        // If no overlap, keep slot as is
        if (!areIntervalsOverlapping(slot, busy)) {
            result.push(slot);
            continue;
        }

        // Overlap exists. We might need to split the slot.

        // Case 1: Slot starts before busy starts -> Available chunk before busy
        if (isBefore(slot.start, busy.start)) {
            result.push({ start: slot.start, end: busy.start });
        }

        // Case 2: Slot ends after busy ends -> Available chunk after busy
        if (isBefore(busy.end, slot.end)) {
            result.push({ start: busy.end, end: slot.end });
        }

        // If busy fully covers slot (Case 3), nothing is pushed.
    }

    return result;
}

/**
 * Checks if two time slots overlap.
 */
export function doSlotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
    return areIntervalsOverlapping(a, b);
}

/**
 * Merges overlapping or adjacent time slots into consolidated slots.
 */
export function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
    if (slots.length === 0) return [];

    // Sort by start time
    const sorted = [...slots].sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: TimeSlot[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        // If current overlaps or is adjacent to last, merge them
        if (current.start.getTime() <= last.end.getTime()) {
            last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
        } else {
            merged.push(current);
        }
    }

    return merged;
}

/**
 * Generates time slots of a fixed duration within a range.
 * 
 * @param start Range start
 * @param end Range end
 * @param durationMinutes Duration of each slot in minutes
 */
export function generateTimeSlots(
    start: Date,
    end: Date,
    durationMinutes: number
): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const durationMs = durationMinutes * 60 * 1000;

    let current = new Date(start);

    while (current.getTime() + durationMs <= end.getTime()) {
        slots.push({
            start: new Date(current),
            end: new Date(current.getTime() + durationMs),
        });
        current = new Date(current.getTime() + durationMs);
    }

    return slots;
}
