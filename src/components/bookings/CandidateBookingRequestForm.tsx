'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useState } from 'react';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';

const CandidateBookingCheckout = dynamic(
    () => import('@/components/bookings/CandidateBookingCheckout').then((mod) => mod.CandidateBookingCheckout),
    {
        ssr: false,
        loading: () => (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm text-sm text-gray-500">
                Loading secure payment form...
            </div>
        ),
    },
);

interface CandidateBookingRequestFormProps {
    professionalId: string;
    priceCents: number;
    professionalTimezone?: string | null;
    candidateTimezone?: string;
    isGoogleCalendarConnected: boolean;
    initialAvailabilitySlots?: SlotInterval[];
}

export function CandidateBookingRequestForm({
    professionalId,
    priceCents,
    professionalTimezone,
    candidateTimezone,
    isGoogleCalendarConnected,
    initialAvailabilitySlots = [],
}: CandidateBookingRequestFormProps) {
    const { createBookingRequest } = useTrackedCandidateBookingActions();
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>(() => initialAvailabilitySlots);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resolvedCandidateTimezone = React.useMemo(
        () => candidateTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [candidateTimezone]
    );

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
        },
        []
    );

    const handleCreateRequest = async () => {
        if (availabilitySlots.length === 0) {
            setError('Select at least one available 30-minute slot before continuing.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            const result = await createBookingRequest({
                professionalId,
                availabilitySlots,
                timezone: resolvedCandidateTimezone,
            });
            setClientSecret(result.clientSecret);
            setBookingId(result.bookingId);
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsSubmitting(false);
        }
    };

    if (clientSecret && bookingId) {
        return <CandidateBookingCheckout bookingId={bookingId} clientSecret={clientSecret} />;
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <CandidateAvailabilityPanel
                calendarTimezone={resolvedCandidateTimezone}
                isGoogleCalendarConnected={isGoogleCalendarConnected}
                professionalTimezone={professionalTimezone}
                initialSelectedSlots={initialAvailabilitySlots}
                onSelectionChange={handleSlotSelectionChange}
                selectedCountLabel="Selected Candidate Slots"
                className="mb-4"
            />

            <div className="flex justify-between items-center mb-6 pt-4 border-t">
                <span className="font-semibold">Session Price:</span>
                <span className="text-xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceCents / 100)}
                </span>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            )}

            <Button
                onClick={handleCreateRequest}
                disabled={isSubmitting}
                variant="primary"
                className="w-full justify-center"
            >
                {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
            </Button>
        </div>
    );
}
