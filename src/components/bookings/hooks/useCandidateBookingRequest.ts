'use client';

import { useCallback, useState } from 'react';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { createCandidateBookingRequest } from '@/components/bookings/services/candidateBookingApi';

type BookingRequestPayload = {
    professionalId: string;
    availabilitySlots: SlotInterval[];
    timezone: string;
};

export function buildCandidateBookingRequestPayload(payload: BookingRequestPayload): BookingRequestPayload {
    return payload;
}

export function useCandidateBookingRequest(professionalId: string, timezone: string) {
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitRequest = useCallback(
        async (availabilitySlots: SlotInterval[]) => {
            if (availabilitySlots.length === 0) {
                setError('Select at least one available 30-minute slot before continuing.');
                return null;
            }

            setIsSubmitting(true);
            setError(null);

            try {
                const result = await createCandidateBookingRequest(buildCandidateBookingRequestPayload({
                    professionalId,
                    availabilitySlots,
                    timezone,
                }));

                setClientSecret(result.clientSecret);
                setBookingId(result.bookingId);

                return result;
            } catch (submitError: unknown) {
                if (submitError instanceof Error) {
                    setError(submitError.message);
                } else {
                    setError('Failed to create booking request.');
                }
                return null;
            } finally {
                setIsSubmitting(false);
            }
        },
        [professionalId, timezone]
    );

    return {
        clientSecret,
        bookingId,
        isSubmitting,
        error,
        submitRequest,
    };
}
