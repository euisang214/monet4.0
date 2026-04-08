import { appRoutes } from '@/lib/shared/routes';
import type { SlotInterval } from '@/components/bookings/calendar/types';

interface ApiErrorResponse {
    error?: string;
}

interface BusySlotResponse {
    start?: string;
    end?: string;
}

export async function confirmProfessionalReschedule(bookingId: string, startAt: string) {
    const response = await fetch(appRoutes.api.professional.requestRescheduleConfirm(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startAt }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json()) as ApiErrorResponse;
    throw new Error(payload?.error || 'Failed to confirm reschedule.');
}

export async function submitProfessionalRescheduleProposal(
    bookingId: string,
    slots: SlotInterval[],
    reason?: string
) {
    const response = await fetch(appRoutes.api.professional.requestRescheduleRequest(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots, reason }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to submit reschedule proposal.');
}

export async function rejectProfessionalReschedule(bookingId: string) {
    const response = await fetch(appRoutes.api.professional.requestRescheduleReject(bookingId), {
        method: 'POST',
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json()) as ApiErrorResponse;
    throw new Error(payload?.error || 'Failed to reject reschedule request.');
}

export async function fetchProfessionalGoogleBusyIntervals(): Promise<SlotInterval[]> {
    const response = await fetch(appRoutes.api.professional.busy);
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
