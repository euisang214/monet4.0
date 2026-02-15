'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/primitives/Button';
import { ProfessionalWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';

export interface Slot {
    start: string | Date;
    end: string | Date;
}

interface SecondaryAction {
    label: string;
    loadingLabel: string;
    isLoading: boolean;
    onClick: () => void;
}

interface SlotPickerFormProps {
    slots: Slot[];
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    /** Short instruction shown below the heading, e.g. "Choose one of the candidate's…" */
    description: string;
    /** Heading shown above the slot picker */
    heading?: string;
    /** Primary confirm button */
    confirmLabel: string;
    confirmingLabel: string;
    isConfirming: boolean;
    onConfirm: (selectedSlot: string) => void;
    /** Whether the primary button is disabled for reasons beyond slot selection */
    isDisabled?: boolean;
    /** Error message to display */
    error?: string | null;
    /** Optional secondary action (e.g. "Reject Reschedule") */
    secondaryAction?: SecondaryAction;
}

export function SlotPickerForm({
    slots,
    calendarTimezone,
    professionalTimezone,
    description,
    heading = 'Select a Time',
    confirmLabel,
    confirmingLabel,
    isConfirming,
    onConfirm,
    isDisabled = false,
    error,
    secondaryAction,
}: SlotPickerFormProps) {
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    const handleConfirm = () => {
        if (!selectedSlot) return;
        onConfirm(selectedSlot);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">{heading}</h3>
                <p className="text-sm text-gray-500 mb-4">{description}</p>

                <ProfessionalWeeklySlotPicker
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={(slot) => setSelectedSlot(slot)}
                    calendarTimezone={calendarTimezone}
                    professionalTimezone={professionalTimezone}
                />
            </div>

            {error && (
                <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
                    {error}
                </div>
            )}

            <div className="flex justify-end gap-3">
                {secondaryAction && (
                    <Button
                        type="button"
                        onClick={secondaryAction.onClick}
                        disabled={secondaryAction.isLoading || isConfirming}
                        className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                        {secondaryAction.isLoading ? secondaryAction.loadingLabel : secondaryAction.label}
                    </Button>
                )}
                <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!selectedSlot || isConfirming || isDisabled}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                    {isConfirming ? confirmingLabel : confirmLabel}
                </Button>
            </div>
        </div>
    );
}
