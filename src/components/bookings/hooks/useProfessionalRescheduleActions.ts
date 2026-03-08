'use client';

import { useCallback, useState } from 'react';
import {
    confirmProfessionalReschedule,
    rejectProfessionalReschedule,
} from '@/components/bookings/services/professionalRescheduleApi';

export function useProfessionalRescheduleActions(bookingId: string) {
    const [isConfirming, setIsConfirming] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const confirm = useCallback(
        async (selectedSlot: string | null): Promise<boolean> => {
            if (!selectedSlot) {
                setError('Please select a time slot.');
                return false;
            }

            setIsConfirming(true);
            setError(null);

            try {
                await confirmProfessionalReschedule(bookingId, selectedSlot);
                return true;
            } catch (confirmError: unknown) {
                if (confirmError instanceof Error) {
                    setError(confirmError.message);
                } else {
                    setError('Failed to confirm reschedule.');
                }
                return false;
            } finally {
                setIsConfirming(false);
            }
        },
        [bookingId]
    );

    const reject = useCallback(async (): Promise<boolean> => {
        setIsRejecting(true);
        setError(null);

        try {
            await rejectProfessionalReschedule(bookingId);
            return true;
        } catch (rejectError: unknown) {
            if (rejectError instanceof Error) {
                setError(rejectError.message);
            } else {
                setError('Failed to reject reschedule request.');
            }
            return false;
        } finally {
            setIsRejecting(false);
        }
    }, [bookingId]);

    return {
        isConfirming,
        isRejecting,
        error,
        confirm,
        reject,
    };
}
