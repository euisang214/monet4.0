'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { BookingStatus, RescheduleAwaitingParty, RescheduleProposalSource } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import { SlotPickerForm, type Slot } from '@/components/bookings/SlotPickerForm';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';
import { SurfaceCard } from '@/components/ui/composites/SurfaceCard/SurfaceCard';
import styles from './ReschedulePageClient.module.css';

interface ReschedulePageClientProps {
    bookingId: string;
    bookingStatus: BookingStatus;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    isGoogleCalendarConnected: boolean;
    initialAvailabilitySlots?: SlotInterval[];
    awaitingParty?: RescheduleAwaitingParty | null;
    proposalSource?: RescheduleProposalSource | null;
    proposalSlots?: SlotInterval[];
    previousStartAt?: string | null;
    previousEndAt?: string | null;
}

export function ReschedulePageClient({
    bookingId,
    bookingStatus,
    calendarTimezone,
    professionalTimezone,
    isGoogleCalendarConnected,
    initialAvailabilitySlots = [],
    awaitingParty,
    proposalSource,
    proposalSlots = [],
    previousStartAt,
    previousEndAt,
}: ReschedulePageClientProps) {
    const router = useRouter();
    const { acceptRescheduleProposal, submitRescheduleRequest } = useTrackedCandidateBookingActions();
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>(() => initialAvailabilitySlots);
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const resolvedCalendarTimezone = useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );
    const isAwaitingCandidate =
        bookingStatus === BookingStatus.reschedule_pending
        && awaitingParty === RescheduleAwaitingParty.CANDIDATE
        && proposalSource === RescheduleProposalSource.PROFESSIONAL;
    const canSubmitAvailability = bookingStatus === BookingStatus.accepted || isAwaitingCandidate;

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
        },
        []
    );

    const handleSubmit = async () => {
        if (!bookingId || availabilitySlots.length === 0) {
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

    const handleAcceptProposal = async (selectedSlot: string) => {
        const match = proposalSlots.find((slot) => slot.start === selectedSlot);
        if (!match) {
            setError('Please choose one of the professional’s proposed slots.');
            return;
        }

        setIsAccepting(true);
        setError(null);
        try {
            await acceptRescheduleProposal({
                bookingId,
                startAt: match.start,
                endAt: match.end,
            });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsAccepting(false);
        }
    };

    const previousScheduleSummary = previousStartAt && previousEndAt
        ? `Previously scheduled for ${new Date(previousStartAt).toLocaleString()} - ${new Date(previousEndAt).toLocaleString()}`
        : null;
    const proposalSlotOptions: Slot[] = proposalSlots;

    return (
        <div className={styles.page}>
            <div className={styles.intro}>
                <h1 className={styles.title}>Reschedule booking</h1>
                <p className={styles.description}>
                {bookingStatus === BookingStatus.accepted
                    ? 'Select new availability to begin a reschedule request.'
                    : isAwaitingCandidate
                        ? 'The professional proposed new times. Accept one below or send a replacement set of times.'
                        : 'Your reschedule request is still pending review.'}
                </p>
            </div>

            {previousScheduleSummary ? (
                <div className={styles.notice}>
                    {previousScheduleSummary}. The original slot is no longer confirmed while this reschedule stays pending.
                </div>
            ) : null}

            {isAwaitingCandidate && proposalSlotOptions.length > 0 ? (
                <div>
                    <SlotPickerForm
                        slots={proposalSlotOptions}
                        calendarTimezone={resolvedCalendarTimezone}
                        professionalTimezone={professionalTimezone}
                        heading="Professional Proposed Times"
                        workflowTitle="Review the professional’s proposal"
                        workflowDescription="Accept one of the suggested times below or continue down to propose a replacement set."
                        steps={[
                            {
                                label: 'Review proposal',
                                description: 'Look through the professional’s offered times.',
                                status: 'current',
                            },
                            {
                                label: 'Accept or replace',
                                description: 'Choose one slot or send an alternate set of times.',
                                status: 'upcoming',
                            },
                        ]}
                        description="Choose one of the proposed 30-minute slots to finalize the new meeting time."
                        confirmLabel="Accept Proposed Time"
                        confirmingLabel="Accepting..."
                        isConfirming={isAccepting}
                        onConfirm={handleAcceptProposal}
                        error={error}
                        summaryFooter="If none of these work, use the alternate-times section below to send a replacement round."
                    />
                </div>
            ) : null}

            {canSubmitAvailability ? (
                <SurfaceCard className={styles.requestCard}>
                    <div className={styles.requestHeader}>
                        <h2 className={styles.requestTitle}>
                            {isAwaitingCandidate ? 'Suggest alternate or additional times' : 'Share new availability'}
                        </h2>
                        <p className={styles.requestDescription}>
                            {isAwaitingCandidate
                                ? 'Send a replacement set of times for the professional to review.'
                                : 'Select the times that work for you so the professional can review and confirm one.'}
                        </p>
                    </div>

                    <CandidateAvailabilityPanel
                        calendarTimezone={resolvedCalendarTimezone}
                        isGoogleCalendarConnected={isGoogleCalendarConnected}
                        professionalTimezone={professionalTimezone}
                        initialSelectedSlots={initialAvailabilitySlots}
                        onSelectionChange={handleSlotSelectionChange}
                    />

                    <div className={styles.reasonSection}>
                        <label className={styles.reasonLabel}>Reason (optional)</label>
                        <textarea
                            className={styles.reasonInput}
                            rows={3}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="e.g. Conflict with work meeting..."
                        />
                    </div>

                    {error ? <div className={styles.error}>{error}</div> : null}

                    <div className={styles.actions}>
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
                            {isSubmitting
                                ? 'Submitting...'
                                : isAwaitingCandidate
                                    ? 'Send New Times'
                                    : 'Submit Request'}
                        </Button>
                    </div>
                </SurfaceCard>
            ) : (
                <SurfaceCard className={styles.waitingCard}>
                    Waiting for the professional to review the most recent set of proposed times.
                </SurfaceCard>
            )}
        </div>
    );
}
