import {
    mergeTimeRanges,
    subtractTimeRangeFromRanges,
    timeRangesOverlap,
} from '@/lib/shared/time-intervals';

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
    return currentSlots.flatMap((slot) => subtractTimeRangeFromRanges([slot], busy).map((range) => ({
        start: range.start,
        end: range.end,
        timezone: slot.timezone,
    })));
}

/**
 * Checks if two time slots overlap.
 */
export function doSlotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
    return timeRangesOverlap(a, b);
}

/**
 * Merges overlapping or adjacent time slots into consolidated slots.
 */
export function mergeOverlappingSlots(slots: TimeSlot[]): TimeSlot[] {
    const sorted = [...slots].sort((left, right) => left.start.getTime() - right.start.getTime());
    const mergedRanges = mergeTimeRanges(sorted);

    return mergedRanges.map((range) => {
        const source = sorted.find((slot) => (
            slot.start.getTime() <= range.start.getTime()
            && slot.end.getTime() >= range.start.getTime()
        ));

        return {
            start: range.start,
            end: range.end,
            timezone: source?.timezone,
        };
    });
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
