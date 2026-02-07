interface ApiErrorResponse {
    error?: string;
}

export async function confirmProfessionalReschedule(bookingId: string, startAt: string) {
    const response = await fetch(`/api/professional/bookings/${bookingId}/reschedule/confirm`, {
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

export async function rejectProfessionalReschedule(bookingId: string) {
    const response = await fetch(`/api/professional/bookings/${bookingId}/reschedule/reject`, {
        method: 'POST',
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json()) as ApiErrorResponse;
    throw new Error(payload?.error || 'Failed to reject reschedule request.');
}
