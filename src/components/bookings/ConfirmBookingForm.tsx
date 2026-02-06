"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { confirmBookingAction } from "@/app/professional/bookings/actions"; // Adjust import if needed
import { ProfessionalWeeklySlotPicker } from "@/components/bookings/WeeklySlotCalendar";

interface Slot {
    start: string | Date;
    end: string | Date;
}

interface ConfirmBookingFormProps {
    bookingId: string;
    slots: Slot[];
}

export function ConfirmBookingForm({ bookingId, slots }: ConfirmBookingFormProps) {
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedSlot) {
            setError("Please select a time slot.");
            return;
        }

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
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Select a Time</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Choose one of the candidate&apos;s submitted 30-minute slots (already filtered against Google busy blocks).
                </p>

                <ProfessionalWeeklySlotPicker
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={(slot) => setSelectedSlot(slot)}
                />
            </div>

            {error && (
                <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-3">
                <Button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                    disabled={!selectedSlot || isPending}
                >
                    {isPending ? "Confirming..." : "Confirm & Schedule"}
                </Button>
            </div>
        </form>
    );
}
