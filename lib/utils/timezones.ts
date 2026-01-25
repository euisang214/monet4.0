import { toZonedTime, formatInTimeZone as dateFnsFormatInTimeZone } from 'date-fns-tz';
import { format as formatDate } from 'date-fns';

/**
 * Converts a date to UTC.
 * Since DB stores dates in UTC, this is largely for ensuring
 * explicit handling if we receive date strings.
 */
export function toUTC(date: Date | string | number): Date {
    return new Date(date);
}

/**
 * Converts a date to a specific timezone.
 * Returns a Date object that represents the time in the target timezone.
 * Note: The Date object in JS is always effectively UTC/Local.
 * This function is useful when you need to perform operations "as if" in that timezone,
 * but be careful—the underlying timestamp remains absolute.
 * Usually, `formatInTimeZone` is what is needed for display.
 */
export function toZonedDate(date: Date | string | number, timeZone: string): Date {
    return toZonedTime(date, timeZone);
}

/**
 * Formats a date in a specific timezone.
 * This is the primary function for displaying dates to users in their local time.
 */
export function formatInTimeZone(
    date: Date | string | number,
    timeZone: string,
    formatStr: string
): string {
    return dateFnsFormatInTimeZone(date, timeZone, formatStr);
}

/**
 * Returns the IANA timezone of the server/environment.
 * Should usually be UTC in production.
 */
export function getServerTimezone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
