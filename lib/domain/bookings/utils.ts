import { differenceInHours } from 'date-fns';

/**
 * Booking utility functions
 */

/**
 * Determines if a cancellation is considered "late" (within 6 hours of start).
 * 
 * @param startAt Booking start time
 * @param cancelledAt Time of cancellation (defaults to now)
 * @returns true if cancelled within 6 hours of start time
 */
export function isLateCancellation(startAt: Date, cancelledAt: Date = new Date()): boolean {
    const hoursUntilStart = differenceInHours(startAt, cancelledAt);
    return hoursUntilStart < 6;
}
