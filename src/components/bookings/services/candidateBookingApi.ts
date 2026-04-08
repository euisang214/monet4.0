import type { SlotInterval } from '@/components/bookings/calendar/types';
import { appRoutes } from '@/lib/shared/routes';
import type { DisputeReason } from '@prisma/client';

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

interface AcceptRescheduleArgs {
    bookingId: string;
    startAt: string;
    endAt: string;
}

interface CancelBookingArgs {
    bookingId: string;
}

interface SubmitReviewArgs {
    bookingId: string;
    rating: number;
    text: string;
    timezone: string;
}

interface SubmitDisputeArgs {
    bookingId: string;
    reason: DisputeReason;
    description: string;
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

export async function acceptCandidateRescheduleProposal({
    bookingId,
    startAt,
    endAt,
}: AcceptRescheduleArgs) {
    const response = await fetch(appRoutes.api.candidate.bookingRescheduleAccept(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt, endAt }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to accept reschedule proposal.');
}

export async function cancelCandidateBooking({ bookingId }: CancelBookingArgs) {
    const response = await fetch(appRoutes.api.shared.bookingCancel(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to cancel booking.');
}

export async function submitCandidateReview({
    bookingId,
    rating,
    text,
    timezone,
}: SubmitReviewArgs) {
    const response = await fetch(appRoutes.api.candidate.reviews, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            bookingId,
            rating,
            text,
            timezone,
        }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to submit review');
}

export async function submitCandidateDispute({
    bookingId,
    reason,
    description,
}: SubmitDisputeArgs) {
    const response = await fetch(appRoutes.api.candidate.bookingDispute(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to submit dispute');
}
