import { describe, it, expect } from 'vitest';
import {
    formatDisplayDate,
    formatDisplayTime,
    formatDisplayDateTime,
    formatShortDate,
    addBusinessDays,
} from '@/lib/utils/date';
import {
    toUTC,
    toZonedDate,
    formatInTimeZone,
    getServerTimezone,
} from '@/lib/utils/timezones';

describe('Date Utilities', () => {
    describe('formatDisplayDate', () => {
        it('should format date correctly in America/New_York', () => {
            const date = new Date('2026-01-24T15:30:00Z');
            const result = formatDisplayDate(date, 'America/New_York');
            expect(result).toBe('January 24, 2026');
        });

        it('should format date correctly in UTC', () => {
            const date = new Date('2026-01-24T00:00:00Z');
            const result = formatDisplayDate(date, 'UTC');
            expect(result).toBe('January 24, 2026');
        });

        it('should handle midnight edge case across timezone boundary', () => {
            // Midnight UTC is still Jan 23 in New York (EST = UTC-5)
            const date = new Date('2026-01-24T03:00:00Z');
            const result = formatDisplayDate(date, 'America/New_York');
            expect(result).toBe('January 23, 2026');
        });
    });

    describe('formatDisplayTime', () => {
        it('should format time with AM correctly', () => {
            const date = new Date('2026-01-24T14:30:00Z'); // 9:30 AM in NYC
            const result = formatDisplayTime(date, 'America/New_York');
            expect(result).toBe('9:30 AM');
        });

        it('should format time with PM correctly', () => {
            const date = new Date('2026-01-24T20:30:00Z'); // 3:30 PM in NYC
            const result = formatDisplayTime(date, 'America/New_York');
            expect(result).toBe('3:30 PM');
        });
    });

    describe('formatDisplayDateTime', () => {
        it('should combine date and time with "at" separator', () => {
            const date = new Date('2026-01-24T20:30:00Z');
            const result = formatDisplayDateTime(date, 'America/New_York');
            expect(result).toBe('January 24, 2026 at 3:30 PM');
        });
    });

    describe('formatShortDate', () => {
        it('should return abbreviated month and day', () => {
            const date = new Date('2026-01-24T15:30:00Z');
            const result = formatShortDate(date, 'America/New_York');
            expect(result).toBe('Jan 24');
        });
    });

    describe('addBusinessDays', () => {
        it('should add days excluding weekends', () => {
            // Friday Jan 23, 2026
            const friday = new Date('2026-01-23T12:00:00Z');
            const result = addBusinessDays(friday, 3);
            // Should skip Sat/Sun and return Wed Jan 28
            expect(result.getDay()).toBe(3); // Wednesday
            expect(result.getDate()).toBe(28);
        });

        it('should handle starting on Saturday', () => {
            // Saturday Jan 24, 2026
            const saturday = new Date('2026-01-24T12:00:00Z');
            const result = addBusinessDays(saturday, 1);
            // Should skip Sun and return Mon Jan 26
            expect(result.getDay()).toBe(1); // Monday
            expect(result.getDate()).toBe(26);
        });

        it('should handle 0 days', () => {
            const date = new Date('2026-01-24T12:00:00Z');
            const result = addBusinessDays(date, 0);
            expect(result.getTime()).toBe(date.getTime());
        });
    });
});

describe('Timezone Utilities', () => {
    describe('toUTC', () => {
        it('should convert Date input', () => {
            const date = new Date('2026-01-24T15:30:00Z');
            const result = toUTC(date);
            expect(result instanceof Date).toBe(true);
            expect(result.toISOString()).toBe('2026-01-24T15:30:00.000Z');
        });

        it('should convert string input', () => {
            const result = toUTC('2026-01-24T15:30:00Z');
            expect(result instanceof Date).toBe(true);
        });

        it('should convert number input (timestamp)', () => {
            const timestamp = Date.now();
            const result = toUTC(timestamp);
            expect(result instanceof Date).toBe(true);
        });
    });

    describe('toZonedDate', () => {
        it('should convert to America/Los_Angeles', () => {
            const date = new Date('2026-01-24T20:00:00Z');
            const result = toZonedDate(date, 'America/Los_Angeles');
            expect(result instanceof Date).toBe(true);
        });

        it('should convert to Europe/London', () => {
            const date = new Date('2026-01-24T20:00:00Z');
            const result = toZonedDate(date, 'Europe/London');
            expect(result instanceof Date).toBe(true);
        });
    });

    describe('formatInTimeZone', () => {
        it('should format with custom format string', () => {
            const date = new Date('2026-01-24T20:30:00Z');
            const result = formatInTimeZone(date, 'America/New_York', 'yyyy-MM-dd HH:mm');
            expect(result).toBe('2026-01-24 15:30');
        });

        it('should handle different timezones', () => {
            const date = new Date('2026-01-24T12:00:00Z');
            const nyResult = formatInTimeZone(date, 'America/New_York', 'HH:mm');
            const laResult = formatInTimeZone(date, 'America/Los_Angeles', 'HH:mm');
            expect(nyResult).toBe('07:00');
            expect(laResult).toBe('04:00');
        });
    });

    describe('getServerTimezone', () => {
        it('should return a valid IANA timezone string', () => {
            const result = getServerTimezone();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            // Should contain a slash (e.g., "America/New_York" or "UTC")
            expect(result).toMatch(/^[A-Za-z_]+\/[A-Za-z_]+$|^UTC$/);
        });
    });
});
