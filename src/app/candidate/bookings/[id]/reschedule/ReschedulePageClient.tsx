'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useCandidateRescheduleRequest } from '@/components/bookings/hooks/useCandidateRescheduleRequest';

interface ReschedulePageClientProps {
    bookingId: string;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
}

export function ReschedulePageClient({
    bookingId,
    calendarTimezone,
    professionalTimezone,
}: ReschedulePageClientProps) {
    const router = useRouter();
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>([]);
    const [reason, setReason] = useState('');
    const resolvedCalendarTimezone = React.useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );

    const { isSubmitting, error, submitRequest } = useCandidateRescheduleRequest(
        bookingId,
        resolvedCalendarTimezone
    );

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
        },
        []
    );

    const handleSubmit = async () => {
        const success = await submitRequest({
            slots: availabilitySlots,
            reason,
        });

        if (!success || !bookingId) {
            return;
        }

        router.push(`/candidate/bookings/${bookingId}`);
        router.refresh();
    };

    return (
        <div className="container mx-auto py-8 max-w-3xl">
            <h1 className="text-2xl font-bold mb-2">Reschedule Booking</h1>
            <p className="text-sm text-gray-600 mb-6">
                Select your new availability on the calendar. The professional will pick one slot from this set.
            </p>

            <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                <CandidateAvailabilityPanel
                    calendarTimezone={resolvedCalendarTimezone}
                    professionalTimezone={professionalTimezone}
                    onSelectionChange={handleSlotSelectionChange}
                />

                <div className="mt-6">
                    <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                    <textarea
                        className="w-full border rounded p-2 text-sm"
                        rows={3}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="e.g. Conflict with work meeting..."
                    />
                </div>

                {error && (
                    <div className="mt-4 text-red-600 text-sm bg-red-50 p-2 rounded">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || availabilitySlots.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}
