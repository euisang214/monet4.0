'use client';

import { useCallback, useState } from 'react';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { submitCandidateRescheduleRequest } from '@/components/bookings/services/candidateBookingApi';

interface SubmitRescheduleArgs {
    slots: SlotInterval[];
    reason?: string;
}

type RescheduleRequestPayload = {
    bookingId: string;
    slots: SlotInterval[];
    reason?: string;
    timezone: string;
};

export function buildCandidateRescheduleRequestPayload(
    payload: RescheduleRequestPayload
): RescheduleRequestPayload {
    return payload;
}

export function useCandidateRescheduleRequest(bookingId: string | undefined, timezone: string) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitRequest = useCallback(
        async ({ slots, reason }: SubmitRescheduleArgs): Promise<boolean> => {
            if (!bookingId) {
                setError('Missing booking ID.');
                return false;
            }

            if (slots.length === 0) {
                setError('Please propose at least one time slot.');
                return false;
            }

            setIsSubmitting(true);
            setError(null);

            try {
                await submitCandidateRescheduleRequest(buildCandidateRescheduleRequestPayload({
                    bookingId,
                    slots,
                    reason,
                    timezone,
                }));
                return true;
            } catch (submitError: unknown) {
                if (submitError instanceof Error) {
                    setError(submitError.message);
                } else {
                    setError('Failed to submit reschedule request.');
                }
                return false;
            } finally {
                setIsSubmitting(false);
            }
        },
        [bookingId, timezone]
    );

    return {
        isSubmitting,
        error,
        submitRequest,
    };
}
