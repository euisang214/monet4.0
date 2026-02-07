'use client';

import React, { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CandidateWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useCandidateGoogleBusy } from '@/components/bookings/hooks/useCandidateGoogleBusy';
import { useCandidateRescheduleRequest } from '@/components/bookings/hooks/useCandidateRescheduleRequest';

export default function ReschedulePage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const bookingId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>([]);
    const [selectedSlotCount, setSelectedSlotCount] = useState(0);
    const [reason, setReason] = useState('');

    const { googleBusyIntervals, isLoadingBusy, busyLoadError, lastBusyRefreshAt, refreshGoogleBusy } =
        useCandidateGoogleBusy();

    const { isSubmitting, error, submitRequest } = useCandidateRescheduleRequest(bookingId);

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots, selectedCount }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
            setSelectedSlotCount(selectedCount);
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
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void refreshGoogleBusy()}
                        disabled={isLoadingBusy}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        {isLoadingBusy ? 'Refreshing calendar...' : 'Refresh Google Calendar'}
                    </button>
                    {lastBusyRefreshAt && (
                        <span className="text-xs text-gray-500">
                            Last synced {lastBusyRefreshAt.toLocaleTimeString()}
                        </span>
                    )}
                </div>

                {busyLoadError && (
                    <div className="mb-3 p-3 bg-yellow-50 text-yellow-700 rounded text-sm">
                        {busyLoadError}
                    </div>
                )}

                <CandidateWeeklySlotPicker
                    googleBusyIntervals={googleBusyIntervals}
                    onChange={handleSlotSelectionChange}
                />

                <p className="text-sm text-gray-500 mt-4">
                    Selected candidate slots: <span className="font-medium">{selectedSlotCount}</span>
                </p>

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
