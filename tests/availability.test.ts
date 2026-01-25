import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCombinedAvailability } from '@/lib/domain/shared/availability';
import { prisma } from '@/lib/core/db';
import * as GoogleIntegration from '@/lib/integrations/calendar/google';
import { addHours, parseISO } from 'date-fns';

// Mock dependencies
vi.mock('@/lib/core/db', () => ({
    prisma: {
        availability: {
            findMany: vi.fn(),
        },
        booking: {
            findMany: vi.fn(),
        },
        oAuthAccount: {
            findFirst: vi.fn(),
        }
    },
}));

vi.mock('@/lib/integrations/calendar/google', () => ({
    getGoogleBusyTimes: vi.fn(),
}));

describe('getCombinedAvailability', () => {
    const userId = 'user_123';
    const baseDate = parseISO('2026-01-23T00:00:00Z'); // Start of day UTC
    const endOfDay = parseISO('2026-01-23T23:59:59Z');

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return manual slots when no busy times exist', async () => {
        // Setup: User available 9-5 UTC
        const manualSlots = [{
            userId,
            start: addHours(baseDate, 9), // 09:00
            end: addHours(baseDate, 17),  // 17:00
            busy: false,
            timezone: 'UTC',
            id: 'slot1'
        }];

        (prisma.availability.findMany as any).mockResolvedValue(manualSlots);
        (prisma.booking.findMany as any).mockResolvedValue([]);
        (GoogleIntegration.getGoogleBusyTimes as any).mockResolvedValue([]);

        const result = await getCombinedAvailability(userId, baseDate, endOfDay);

        expect(result).toHaveLength(1);
        expect(result[0].start).toEqual(manualSlots[0].start);
        expect(result[0].end).toEqual(manualSlots[0].end);
    });

    it('should subtract internal booking from manual slots', async () => {
        // Available 9-17
        const manualSlots = [{
            userId,
            start: addHours(baseDate, 9),
            end: addHours(baseDate, 17),
            busy: false,
        }];

        // Booking 12-13
        const bookings = [{
            startAt: addHours(baseDate, 12),
            endAt: addHours(baseDate, 13),
            status: 'accepted',
        }];

        (prisma.availability.findMany as any).mockResolvedValue(manualSlots);
        (prisma.booking.findMany as any).mockResolvedValue(bookings);
        (GoogleIntegration.getGoogleBusyTimes as any).mockResolvedValue([]);

        const result = await getCombinedAvailability(userId, baseDate, endOfDay);

        // Expect split: 9-12 and 13-17
        expect(result).toHaveLength(2);
        expect(result[0].start).toEqual(addHours(baseDate, 9));
        expect(result[0].end).toEqual(addHours(baseDate, 12));
        expect(result[1].start).toEqual(addHours(baseDate, 13));
        expect(result[1].end).toEqual(addHours(baseDate, 17));
    });

    it('should subtract google busy time from manual slots', async () => {
        // Available 9-17
        const manualSlots = [{
            userId,
            start: addHours(baseDate, 9),
            end: addHours(baseDate, 17),
            busy: false,
        }];

        // Google Busy 10-11
        const googleBusy = [{
            start: addHours(baseDate, 10),
            end: addHours(baseDate, 11),
        }];

        (prisma.availability.findMany as any).mockResolvedValue(manualSlots);
        (prisma.booking.findMany as any).mockResolvedValue([]);
        (GoogleIntegration.getGoogleBusyTimes as any).mockResolvedValue(googleBusy);

        const result = await getCombinedAvailability(userId, baseDate, endOfDay);

        // Expect split: 9-10 and 11-17
        expect(result).toHaveLength(2);
        expect(result[0].start).toEqual(addHours(baseDate, 9));
        expect(result[0].end).toEqual(addHours(baseDate, 10));
        expect(result[1].start).toEqual(addHours(baseDate, 11));
        expect(result[1].end).toEqual(addHours(baseDate, 17));
    });

    it('should handle overlapping busy times correctly', async () => {
        // Available 9-17
        const manualSlots = [{
            userId,
            start: addHours(baseDate, 9),
            end: addHours(baseDate, 17),
            busy: false,
        }];

        // Booking 12-13
        const bookings = [{
            startAt: addHours(baseDate, 12),
            endAt: addHours(baseDate, 13),
            status: 'accepted',
        }];

        // Google Busy 12:30-13:30 (overlaps booking)
        const googleBusy = [{
            start: addHours(baseDate, 12.5),
            end: addHours(baseDate, 13.5),
        }];

        (prisma.availability.findMany as any).mockResolvedValue(manualSlots);
        (prisma.booking.findMany as any).mockResolvedValue(bookings);
        (GoogleIntegration.getGoogleBusyTimes as any).mockResolvedValue(googleBusy);

        const result = await getCombinedAvailability(userId, baseDate, endOfDay);

        // Expect split: 9-12 and 13.5-17
        // 12-13 is booked.
        // 12.5-13.5 is google busy.
        // Combined busy: 12-13.5.
        // Available: 9-12, 13.5-17.

        expect(result).toHaveLength(2);
        expect(result[0].start).toEqual(addHours(baseDate, 9));
        expect(result[0].end).toEqual(addHours(baseDate, 12));
        expect(result[1].start).toEqual(addHours(baseDate, 13.5));
        expect(result[1].end).toEqual(addHours(baseDate, 17));
    });
});
