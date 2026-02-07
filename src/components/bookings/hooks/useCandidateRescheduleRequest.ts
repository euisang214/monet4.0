'use client';

import { useCallback, useState } from 'react';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { submitCandidateRescheduleRequest } from '@/components/bookings/services/candidateBookingApi';

interface SubmitRescheduleArgs {
    slots: SlotInterval[];
    reason?: string;
}

export function useCandidateRescheduleRequest(bookingId: string | undefined) {
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
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
                await submitCandidateRescheduleRequest({
                    bookingId,
                    slots,
                    reason,
                    timezone,
                });
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
        [bookingId]
    );

    return {
        isSubmitting,
        error,
        submitRequest,
    };
}
