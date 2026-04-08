"use client";

import React, { useState } from "react";
import { SlotPickerForm, type Slot } from "@/components/bookings/SlotPickerForm";
import { useTrackedProfessionalBookingActions } from "@/components/bookings/hooks/useTrackedProfessionalBookingActions";

interface ConfirmBookingFormProps {
    bookingId: string;
    slots: Slot[];
    calendarTimezone?: string;
    professionalTimezone?: string | null;
}

export function ConfirmBookingForm({
    bookingId,
    slots,
    calendarTimezone,
    professionalTimezone,
}: ConfirmBookingFormProps) {
    const { confirmBooking } = useTrackedProfessionalBookingActions();
    const [isPending, setIsPending] = useState(false);

    const handleConfirm = async (selectedSlot: string) => {
        setIsPending(true);

        try {
            await confirmBooking({ bookingId, startAt: selectedSlot });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsPending(false);
        }
    };

    return (
        <SlotPickerForm
            slots={slots}
            calendarTimezone={calendarTimezone}
            professionalTimezone={professionalTimezone}
            heading="Select a Time"
            description="Choose one of the candidate's submitted 30-minute slots."
            workflowTitle="Confirm this request"
            workflowDescription="Review the candidate’s submitted times, then lock in the slot you want to schedule."
            steps={[
                {
                    label: 'Review candidate times',
                    description: 'Compare the submitted 30-minute options.',
                    status: 'current',
                },
                {
                    label: 'Confirm and schedule',
                    description: 'Finalize the selected slot and capture payment.',
                    status: 'upcoming',
                },
            ]}
            confirmLabel="Confirm & Schedule"
            confirmingLabel="Confirming..."
            isConfirming={isPending}
            onConfirm={handleConfirm}
            summaryFooter="Payment capture and scheduling continue automatically after you confirm the slot."
        />
    );
}
