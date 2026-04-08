'use client';

import dynamic from 'next/dynamic';
import React, { useCallback, useState } from 'react';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import { BookingFlowShell, type BookingFlowStep } from '@/components/bookings/BookingFlowShell';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';
import { SurfaceCard } from '@/components/ui/composites/SurfaceCard/SurfaceCard';
import styles from './CandidateBookingRequestForm.module.css';

const CandidateBookingCheckout = dynamic(
    () => import('@/components/bookings/CandidateBookingCheckout').then((mod) => mod.CandidateBookingCheckout),
    {
        ssr: false,
        loading: () => (
            <div className="text-sm text-gray-500">
                Loading secure payment form...
            </div>
        ),
    },
);

interface CandidateBookingRequestFormProps {
    professionalId: string;
    priceCents: number;
    professionalLabel?: string;
    professionalTimezone?: string | null;
    candidateTimezone?: string;
    isGoogleCalendarConnected: boolean;
    initialAvailabilitySlots?: SlotInterval[];
}

export function CandidateBookingRequestForm({
    professionalId,
    priceCents,
    professionalLabel,
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
    const steps = React.useMemo<BookingFlowStep[]>(
        () => [
            {
                label: 'Share availability',
                description: 'Select times you can make work for a 30-minute session.',
                status: 'current',
            },
            {
                label: 'Payment authorization',
                description: 'Review details and authorize secure payment to finish the request.',
                status: 'upcoming',
            },
        ],
        []
    );
    const formattedPrice = React.useMemo(
        () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceCents / 100),
        [priceCents]
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
        return (
            <CandidateBookingCheckout
                bookingId={bookingId}
                clientSecret={clientSecret}
                priceCents={priceCents}
                professionalLabel={professionalLabel}
                candidateTimezone={resolvedCandidateTimezone}
                professionalTimezone={professionalTimezone}
            />
        );
    }

    return (
        <BookingFlowShell
            eyebrow="Booking request"
            title={`Request a session${professionalLabel ? ` with ${professionalLabel}` : ''}`}
            description="Share the times that work for you now. Once you continue, you’ll review payment details and securely authorize the request."
            steps={steps}
            summaryTitle="Session summary"
            summaryDescription="Everything needed to submit this request, at a glance."
            summary={
                <>
                    <div className={styles.summaryList}>
                        {professionalLabel ? (
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Professional</span>
                                <span className={styles.summaryValue}>{professionalLabel}</span>
                            </div>
                        ) : null}
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Session price</span>
                            <span className={styles.summaryValue}>{formattedPrice}</span>
                        </div>
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Your timezone</span>
                            <span className={styles.summaryValue}>{resolvedCandidateTimezone}</span>
                        </div>
                        {professionalTimezone ? (
                            <div className={styles.summaryRow}>
                                <span className={styles.summaryLabel}>Professional timezone</span>
                                <span className={styles.summaryValue}>{professionalTimezone}</span>
                            </div>
                        ) : null}
                    </div>
                    <ul className={styles.summaryNotes}>
                        <li>Select at least one 30-minute option before continuing.</li>
                        <li>Google Calendar busy blocks can be refreshed and overridden if needed.</li>
                        <li>Your request isn’t complete until payment details are confirmed in the next step.</li>
                    </ul>
                </>
            }
            summaryFooter="You can still adjust your times before you move to payment."
            className={styles.surface}
        >
            <SurfaceCard className={styles.formCard}>
                <CandidateAvailabilityPanel
                    calendarTimezone={resolvedCandidateTimezone}
                    isGoogleCalendarConnected={isGoogleCalendarConnected}
                    professionalTimezone={professionalTimezone}
                    initialSelectedSlots={initialAvailabilitySlots}
                    onSelectionChange={handleSlotSelectionChange}
                    selectedCountLabel="Selected slots"
                />

                <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>Session price</span>
                    <span className={styles.priceValue}>{formattedPrice}</span>
                </div>

                {error ? <div className={styles.error}>{error}</div> : null}

                <div className={styles.actions}>
                    <Button
                        onClick={handleCreateRequest}
                        disabled={isSubmitting}
                        variant="primary"
                    >
                        {isSubmitting ? 'Processing...' : 'Continue to payment'}
                    </Button>
                </div>
            </SurfaceCard>
        </BookingFlowShell>
    );
}
