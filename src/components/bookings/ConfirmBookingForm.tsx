"use client";

import React, { useState, useTransition } from "react";
import { confirmBookingAction } from "@/app/professional/requests/actions";
import { SlotPickerForm, type Slot } from "@/components/bookings/SlotPickerForm";

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
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleConfirm = (selectedSlot: string) => {
        setError(null);

        const formData = new FormData();
        formData.append("bookingId", bookingId);
        formData.append("startAt", selectedSlot);

        startTransition(async () => {
            const result = await confirmBookingAction(formData);
            if (result?.error) {
                setError(result.error);
            }
        });
    };

    return (
        <SlotPickerForm
            slots={slots}
            calendarTimezone={calendarTimezone}
            professionalTimezone={professionalTimezone}
            heading="Select a Time"
            description="Choose one of the candidate's submitted 30-minute slots (already filtered against Google busy blocks)."
            confirmLabel="Confirm & Schedule"
            confirmingLabel="Confirming..."
            isConfirming={isPending}
            onConfirm={handleConfirm}
            error={error}
        />
    );
}
