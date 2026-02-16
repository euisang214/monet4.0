'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useProfessionalRescheduleActions } from '@/components/bookings/hooks/useProfessionalRescheduleActions';
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
    const router = useRouter();
    const { isConfirming, isRejecting, error, confirm, reject } = useProfessionalRescheduleActions(bookingId);

    const handleConfirm = async (selectedSlot: string) => {
        const confirmed = await confirm(selectedSlot);
        if (!confirmed) return;

        router.push('/professional/dashboard');
        router.refresh();
    };

    const handleReject = async () => {
        const rejected = await reject();
        if (!rejected) return;

        router.push('/professional/dashboard');
        router.refresh();
    };

    return (
        <SlotPickerForm
            slots={slots}
            calendarTimezone={calendarTimezone}
            professionalTimezone={professionalTimezone}
            heading="Select a New Time"
            description="Choose one of the candidate's submitted 30-minute slots to confirm this reschedule."
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
