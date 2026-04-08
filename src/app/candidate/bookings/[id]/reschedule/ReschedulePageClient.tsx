'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { BookingStatus, RescheduleAwaitingParty, RescheduleProposalSource } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import { SlotPickerForm, type Slot } from '@/components/bookings/SlotPickerForm';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';

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
    const isAwaitingProfessional =
        bookingStatus === BookingStatus.reschedule_pending
        && awaitingParty === RescheduleAwaitingParty.PROFESSIONAL;
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
        <div className="container mx-auto py-8 max-w-3xl">
            <h1 className="text-2xl font-bold mb-2">Reschedule Booking</h1>
            <p className="text-sm text-gray-600 mb-6">
                {bookingStatus === BookingStatus.accepted
                    ? 'Select new availability to begin a reschedule request.'
                    : isAwaitingCandidate
                        ? 'The professional proposed new times. Accept one below or send a replacement set of times.'
                        : 'Your reschedule request is still pending review.'}
            </p>

            {previousScheduleSummary ? (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {previousScheduleSummary}. The original slot is no longer confirmed while this reschedule stays pending.
                </div>
            ) : null}

            {isAwaitingCandidate && proposalSlotOptions.length > 0 ? (
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <SlotPickerForm
                        slots={proposalSlotOptions}
                        calendarTimezone={resolvedCalendarTimezone}
                        professionalTimezone={professionalTimezone}
                        heading="Professional Proposed Times"
                        description="Choose one of the proposed 30-minute slots to finalize the new meeting time."
                        confirmLabel="Accept Proposed Time"
                        confirmingLabel="Accepting..."
                        isConfirming={isAccepting}
                        onConfirm={handleAcceptProposal}
                        error={error}
                    />
                </div>
            ) : null}

            {canSubmitAvailability ? (
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200">
                    <CandidateAvailabilityPanel
                        calendarTimezone={resolvedCalendarTimezone}
                        isGoogleCalendarConnected={isGoogleCalendarConnected}
                        professionalTimezone={professionalTimezone}
                        initialSelectedSlots={initialAvailabilitySlots}
                        onSelectionChange={handleSlotSelectionChange}
                        heading={isAwaitingCandidate ? 'Suggest Alternate or Additional Times' : undefined}
                        description={isAwaitingCandidate
                            ? 'Share a replacement set of times for the professional to review.'
                            : undefined}
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
                            {isSubmitting
                                ? 'Submitting...'
                                : isAwaitingCandidate
                                    ? 'Send New Times'
                                    : 'Submit Request'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-6 rounded-lg shadow mb-6 border border-gray-200 text-sm text-gray-600">
                    Waiting for the professional to review the most recent set of proposed times.
                </div>
            )}
        </div>
    );
}
