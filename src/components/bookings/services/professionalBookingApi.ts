import { appRoutes } from '@/lib/shared/routes';

interface ApiErrorResponse {
    error?: string;
}

interface ConfirmBookingArgs {
    bookingId: string;
    startAt: string;
}

interface RequestRescheduleArgs {
    bookingId: string;
}

interface RejectProfessionalRequestArgs {
    bookingId: string;
    isReschedule: boolean;
}

interface SubmitProfessionalFeedbackArgs {
    bookingId: string;
    text: string;
    actions: string[];
    contentRating: number;
    deliveryRating: number;
    valueRating: number;
}

export async function confirmProfessionalBooking({ bookingId, startAt }: ConfirmBookingArgs) {
    const response = await fetch(appRoutes.api.professional.requestConfirmAndSchedule(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt }),
    });

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    if (!response.ok) {
        throw new Error(payload?.error || 'Failed to confirm booking');
    }
}

export async function cancelProfessionalUpcomingBooking({ bookingId }: RequestRescheduleArgs) {
    const response = await fetch(appRoutes.api.shared.bookingCancel(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    if (!response.ok) {
        throw new Error(payload?.error || 'Failed to cancel booking.');
    }
}

export async function requestProfessionalReschedule({ bookingId }: RequestRescheduleArgs) {
    const response = await fetch(appRoutes.api.professional.requestRescheduleRequest(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    if (!response.ok) {
        throw new Error(payload?.error || 'Failed to request reschedule.');
    }
}

export async function rejectProfessionalRequest({
    bookingId,
    isReschedule,
}: RejectProfessionalRequestArgs) {
    const endpoint = isReschedule
        ? appRoutes.api.professional.requestRescheduleReject(bookingId)
        : appRoutes.api.professional.requestDecline(bookingId);
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: isReschedule ? undefined : { 'Content-Type': 'application/json' },
        body: isReschedule ? undefined : JSON.stringify({ reason: 'Declined by professional' }),
    });

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    if (!response.ok) {
        throw new Error(payload?.error || 'Failed to reject request');
    }
}

export async function submitProfessionalFeedback({
    bookingId,
    text,
    actions,
    contentRating,
    deliveryRating,
    valueRating,
}: SubmitProfessionalFeedbackArgs) {
    const response = await fetch(appRoutes.api.professional.feedback(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text,
            actions,
            contentRating,
            deliveryRating,
            valueRating,
        }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to submit feedback');
}
