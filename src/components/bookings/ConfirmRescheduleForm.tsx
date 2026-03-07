'use client';

import React from 'react';
import { useTrackedProfessionalBookingActions } from '@/components/bookings/hooks/useTrackedProfessionalBookingActions';
import { SlotPickerForm, type Slot } from '@/components/bookings/SlotPickerForm';

interface ConfirmRescheduleFormProps {
    bookingId: string;
    slots: Slot[];
    calendarTimezone?: string;
    professionalTimezone?: string | null;
}

export function ConfirmRescheduleForm({
    bookingId,
    slots,
    calendarTimezone,
    professionalTimezone,
}: ConfirmRescheduleFormProps) {
    const { confirmReschedule, rejectReschedule } = useTrackedProfessionalBookingActions();
    const [isConfirming, setIsConfirming] = React.useState(false);
    const [isRejecting, setIsRejecting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleConfirm = async (selectedSlot: string) => {
        if (!selectedSlot) {
            setError('Please select a time slot.');
            return;
        }

        setIsConfirming(true);
        setError(null);
        try {
            await confirmReschedule({ bookingId, startAt: selectedSlot });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsConfirming(false);
        }
    };

    const handleReject = async () => {
        setIsRejecting(true);
        setError(null);
        try {
            await rejectReschedule({ bookingId });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <SlotPickerForm
            slots={slots}
            calendarTimezone={calendarTimezone}
            professionalTimezone={professionalTimezone}
            heading="Select a New Time"
            description="Choose one of the candidate's submitted 30-minute slots."
            confirmLabel="Confirm New Time"
            confirmingLabel="Confirming..."
            isConfirming={isConfirming}
            onConfirm={handleConfirm}
            isDisabled={isRejecting}
            error={error}
            secondaryAction={{
                label: 'Reject Reschedule',
                loadingLabel: 'Rejecting...',
                isLoading: isRejecting,
                onClick: handleReject,
            }}
        />
    );
}
