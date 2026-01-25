import { prisma } from '@/lib/core/db';
import { getGoogleBusyTimes } from '@/lib/integrations/calendar/google';
import { isBefore, max, min } from 'date-fns';
import { subtractIntervalFromSlots } from '@/lib/shared/time-slot';

/**
 * Calculates the combined availability for a user.
 * 
 * 1. Start with Manual Availability Slots from DB.
 * 2. Subtract internal Monet Bookings.
 * 3. Subtract Google Calendar Busy Times.
 * 
 * @param userId The user ID to fetch availability for
 * @param start Start of the range (UTC)
 * @param end End of the range (UTC)
 * @returns Array of available time slots { start, end }
 */
export async function getCombinedAvailability(
    userId: string,
    start: Date,
    end: Date
): Promise<{ start: Date; end: Date }[]> {
    // 1. Fetch data in parallel
    const [manualAvailability, existingBookings, googleBusyTimes] = await Promise.all([
        // Manual Availability (Allow-list)
        prisma.availability.findMany({
            where: {
                userId,
                busy: false, // We only care about "available" slots
                start: { lt: end },
                end: { gt: start },
            },
            orderBy: { start: 'asc' },
        }),

        // Internal Bookings (Block-list)
        prisma.booking.findMany({
            where: {
                OR: [
                    { professionalId: userId },
                    { candidateId: userId },
                ],
                status: {
                    in: ['accepted', 'accepted_pending_integrations', 'completed_pending_feedback'],
                },
                startAt: { not: null, lt: end },
                endAt: { not: null, gt: start },
            },
        }),

        // Google Busy Times (Block-list)
        getGoogleBusyTimes(userId, start, end),
    ]);

    // Consolidate all "Busy" intervals
    const busyIntervals: { start: Date; end: Date }[] = [
        ...existingBookings.map((b) => ({ start: b.startAt!, end: b.endAt! })),
        ...googleBusyTimes,
    ];

    // 2. Subtract Busy Intervals from Manual Availability
    let availableSlots: { start: Date; end: Date }[] = manualAvailability.map((slot) => ({
        start: slot.start,
        end: slot.end,
    }));

    for (const busy of busyIntervals) {
        availableSlots = subtractIntervalFromSlots(availableSlots, busy);
    }

    // 3. Filter out past slots (if start is in past) or very short slots?
    // For now return exact computed windows.
    // Optional: Enforce bounds of request (start/end)
    return availableSlots.map(slot => ({
        start: max([slot.start, start]),
        end: min([slot.end, end])
    })).filter(slot => isBefore(slot.start, slot.end)); // valid slots only
}

