import type { SlotInterval } from '@/components/bookings/calendar/types';
import { appRoutes } from '@/lib/shared/routes';

interface BusySlotResponse {
    start?: string;
    end?: string;
}

interface BookingRequestResponse {
    data?: {
        bookingId?: string;
        clientSecret?: string;
    };
    error?: string;
}

interface ApiErrorResponse {
    error?: string;
}

interface CreateBookingRequestArgs {
    professionalId: string;
    availabilitySlots: SlotInterval[];
    timezone: string;
}

interface RescheduleRequestArgs {
    bookingId: string;
    slots: SlotInterval[];
    reason?: string;
    timezone: string;
}

export async function fetchCandidateGoogleBusyIntervals(): Promise<SlotInterval[]> {
    const response = await fetch(appRoutes.api.candidate.busy);
    if (!response.ok) {
        throw new Error('Unable to load Google Calendar busy times.');
    }

    const payload = await response.json();
    if (!Array.isArray(payload?.data)) {
        return [];
    }

    return (payload.data as BusySlotResponse[])
        .filter((slot) => slot?.start && slot?.end)
        .map((slot) => ({
            start: new Date(slot.start as string).toISOString(),
            end: new Date(slot.end as string).toISOString(),
        }));
}

export async function createCandidateBookingRequest({
    professionalId,
    availabilitySlots,
    timezone,
}: CreateBookingRequestArgs) {
    const response = await fetch(appRoutes.api.candidate.professionalBookings(professionalId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availabilitySlots, timezone }),
    });

    const payload = (await response.json()) as BookingRequestResponse;
    if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create booking request.');
    }

    const bookingId = payload?.data?.bookingId;
    const clientSecret = payload?.data?.clientSecret;

    if (!bookingId || !clientSecret) {
        throw new Error('Booking request created, but payment details were missing from the response.');
    }

    return { bookingId, clientSecret };
}

export async function submitCandidateRescheduleRequest({
    bookingId,
    slots,
    reason,
    timezone,
}: RescheduleRequestArgs) {
    const response = await fetch(appRoutes.api.candidate.bookingRescheduleRequest(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slots,
            reason,
            timezone,
        }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json()) as ApiErrorResponse;
    throw new Error(payload?.error || 'Failed to submit reschedule request.');
}
