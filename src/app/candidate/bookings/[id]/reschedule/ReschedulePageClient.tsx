'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';

interface ReschedulePageClientProps {
    bookingId: string;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    isGoogleCalendarConnected: boolean;
    initialAvailabilitySlots?: SlotInterval[];
}

export function ReschedulePageClient({
    bookingId,
    calendarTimezone,
    professionalTimezone,
    isGoogleCalendarConnected,
    initialAvailabilitySlots = [],
}: ReschedulePageClientProps) {
    const router = useRouter();
    const { submitRescheduleRequest } = useTrackedCandidateBookingActions();
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>(() => initialAvailabilitySlots);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resolvedCalendarTimezone = React.useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
        },
        []
    );

    const handleSubmit = async () => {
        if (!bookingId) {
            return;
        }

        if (availabilitySlots.length === 0) {
            setError('Please propose at least one time slot.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await submitRescheduleRequest({
                bookingId,
                slots: availabilitySlots,
                reason,
                timezone: resolvedCalendarTimezone,
            });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsSubmitting(false);
        }
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
                    isGoogleCalendarConnected={isGoogleCalendarConnected}
                    professionalTimezone={professionalTimezone}
                    initialSelectedSlots={initialAvailabilitySlots}
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
                    <Button
                        type="button"
                        onClick={() => router.back()}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || availabilitySlots.length === 0}
                        variant="primary"
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
