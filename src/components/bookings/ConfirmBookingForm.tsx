"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { confirmBookingAction } from "@/app/professional/bookings/actions"; // Adjust import if needed

interface Slot {
    start: Date;
    end: Date;
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
                    Based on the candidate's availability and your calendar.
                </p>

                {slots.length === 0 ? (
                    <div className="p-4 bg-yellow-50 text-yellow-700 rounded-md">
                        No overlapping slots found. Please request more availability from the candidate or manage your calendar.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                        {slots.map((slot) => {
                            const value = slot.start.toISOString();
                            const isSelected = selectedSlot === value;
                            const label = slot.start.toLocaleString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                            });

                            return (
                                <div
                                    key={value}
                                    className={`
                                        cursor-pointer p-3 border rounded-md text-sm text-center
                                        ${isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-blue-300'}
                                    `}
                                    onClick={() => setSelectedSlot(value)}
                                >
                                    {label}
                                </div>
                            );
                        })}
                    </div>
                )}
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
