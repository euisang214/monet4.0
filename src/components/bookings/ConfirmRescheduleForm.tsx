'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/primitives/Button';
import { ProfessionalWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';
import { useProfessionalRescheduleActions } from '@/components/bookings/hooks/useProfessionalRescheduleActions';

interface Slot {
    start: string | Date;
    end: string | Date;
}

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
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

    const { isConfirming, isRejecting, error, confirm, reject } = useProfessionalRescheduleActions(bookingId);

    const handleConfirm = async () => {
        const confirmed = await confirm(selectedSlot);
        if (!confirmed) {
            return;
        }

        router.push('/professional/dashboard');
        router.refresh();
    };

    const handleReject = async () => {
        const rejected = await reject();
        if (!rejected) {
            return;
        }

        router.push('/professional/dashboard');
        router.refresh();
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900">Select a New Time</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Choose one of the candidate&apos;s submitted 30-minute slots to confirm this reschedule.
                </p>

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
                <Button
                    type="button"
                    onClick={handleReject}
                    disabled={isRejecting || isConfirming}
                    className="bg-white border border-red-200 text-red-700 px-4 py-2 rounded hover:bg-red-50 disabled:opacity-50"
                >
                    {isRejecting ? 'Rejecting...' : 'Reject Reschedule'}
                </Button>
                <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!selectedSlot || isConfirming || isRejecting}
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                    {isConfirming ? 'Confirming...' : 'Confirm New Time'}
                </Button>
            </div>
        </div>
    );
}
