import { addDays, isWeekend } from 'date-fns';
import { formatInTimeZone } from '@/lib/utils/timezones';

/**
 * Date Utilities
 * 
 * Complements lib/utils/timezones.ts with additional date helpers.
 */

/**
 * Normalize a value for HTML date inputs.
 */
export function toDateInputValue(value: Date | string | null | undefined): string {
    if (!value) return '';

    if (typeof value === 'string') {
        const dateMatch = value.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
            return dateMatch[0];
        }
    }

    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return '';
    }

    return parsed.toISOString().slice(0, 10);
}

/**
 * Format date for display (e.g., "January 24, 2026")
 */
export function formatDisplayDate(date: Date, timezone: string): string {
    return formatInTimeZone(date, timezone, 'MMMM d, yyyy');
}

/**
 * Format time for display (e.g., "3:30 PM")
 */
export function formatDisplayTime(date: Date, timezone: string): string {
    return formatInTimeZone(date, timezone, 'h:mm a');
}

/**
 * Format date and time together (e.g., "January 24, 2026 at 3:30 PM")
 */
export function formatDisplayDateTime(date: Date, timezone: string): string {
    return formatInTimeZone(date, timezone, "MMMM d, yyyy 'at' h:mm a");
}

/**
 * Format short date (e.g., "Jan 24")
 */
export function formatShortDate(date: Date, timezone: string): string {
    return formatInTimeZone(date, timezone, 'MMM d');
}

/**
 * Add business days to a date (skips weekends)
 */
export function addBusinessDays(date: Date, days: number): Date {
    let result = new Date(date);
    let remaining = days;

    while (remaining > 0) {
        result = addDays(result, 1);
        if (!isWeekend(result)) {
            remaining--;
        }
    }

    return result;
}
