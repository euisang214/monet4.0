'use client';

import React, { useMemo, useState } from 'react';
import { BookingStatus, RescheduleAwaitingParty } from '@prisma/client';
import { SlotPickerForm } from '@/components/bookings/SlotPickerForm';
import { UnifiedWeeklyCalendar } from '@/components/bookings/UnifiedWeeklyCalendar';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useTrackedProfessionalBookingActions } from '@/components/bookings/hooks/useTrackedProfessionalBookingActions';
import { useProfessionalGoogleBusy } from '@/components/bookings/hooks/useProfessionalGoogleBusy';
import { Button } from '@/components/ui/primitives/Button';

interface ProfessionalRescheduleWorkspaceProps {
    bookingId: string;
    bookingStatus: BookingStatus;
    candidateAvailabilitySlots: SlotInterval[];
    proposalSlots: SlotInterval[];
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    isGoogleCalendarConnected: boolean;
    awaitingParty?: RescheduleAwaitingParty | null;
    previousStartAt?: string | null;
    previousEndAt?: string | null;
}

export function ProfessionalRescheduleWorkspace({
    bookingId,
    bookingStatus,
    candidateAvailabilitySlots,
    proposalSlots,
    calendarTimezone,
    professionalTimezone,
    isGoogleCalendarConnected,
    awaitingParty,
    previousStartAt,
    previousEndAt,
}: ProfessionalRescheduleWorkspaceProps) {
    const {
        confirmReschedule,
        submitRescheduleProposal,
    } = useTrackedProfessionalBookingActions();
    const [isConfirming, setIsConfirming] = useState(false);
    const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
    const [proposalMode, setProposalMode] = useState(false);
    const [proposalSlotsState, setProposalSlotsState] = useState<SlotInterval[]>([]);
    const [proposalError, setProposalError] = useState<string | null>(null);
    const {
        googleBusyIntervals,
        isLoadingBusy,
        refreshGoogleBusy,
    } = useProfessionalGoogleBusy({ autoLoad: isGoogleCalendarConnected });

    const confirmationSlots = useMemo(
        () => (bookingStatus === BookingStatus.accepted ? candidateAvailabilitySlots : proposalSlots),
        [bookingStatus, candidateAvailabilitySlots, proposalSlots]
    );
    const canActOnPendingRound =
        bookingStatus === BookingStatus.accepted
        || awaitingParty === RescheduleAwaitingParty.PROFESSIONAL;
    const isWaitingOnCandidate =
        bookingStatus === BookingStatus.reschedule_pending
        && awaitingParty === RescheduleAwaitingParty.CANDIDATE;
    const proposalCalendarTimezone = professionalTimezone || calendarTimezone;
    const proposalCounterpartTimezone = calendarTimezone;

    const handleConfirm = async (selectedSlot: string) => {
        setIsConfirming(true);
        try {
            await confirmReschedule({ bookingId, startAt: selectedSlot });
        } catch {
            // Toast handles async failure.
        } finally {
            setIsConfirming(false);
        }
    };

    const handleSubmitProposal = async () => {
        if (proposalSlotsState.length === 0) {
            setProposalError('Select at least one new time to propose.');
            return;
        }

        setIsSubmittingProposal(true);
        setProposalError(null);
        try {
            await submitRescheduleProposal({
                bookingId,
                slots: proposalSlotsState,
            });
        } catch {
            // Toast handles async failure.
        } finally {
            setIsSubmittingProposal(false);
        }
    };

    return (
        <div className="space-y-6">
            {previousStartAt && previousEndAt && bookingStatus === BookingStatus.reschedule_pending ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    Previously scheduled for {new Date(previousStartAt).toLocaleString()} - {new Date(previousEndAt).toLocaleString()}.
                    The original slot is no longer confirmed while this negotiation remains pending.
                </div>
            ) : null}

            {confirmationSlots.length > 0 && canActOnPendingRound ? (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <SlotPickerForm
                        slots={confirmationSlots}
                        calendarTimezone={calendarTimezone}
                        professionalTimezone={professionalTimezone}
                        heading={bookingStatus === BookingStatus.accepted ? 'Confirm a Current Candidate Slot' : 'Candidate Returned Times'}
                        description={
                            bookingStatus === BookingStatus.accepted
                                ? 'Choose one of the candidate’s currently available slots to reschedule immediately.'
                                : 'Choose one of the candidate’s returned slots to finalize the new meeting time.'
                        }
                        confirmLabel={bookingStatus === BookingStatus.accepted ? 'Confirm New Time' : 'Accept Candidate Time'}
                        confirmingLabel="Confirming..."
                        isConfirming={isConfirming}
                        onConfirm={handleConfirm}
                    />
                </div>
            ) : null}

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Propose Other Times</h2>
                        <p className="text-sm text-gray-600">
                            Highlight new professional-preferred slots outside the currently shown candidate times.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            onClick={() => void refreshGoogleBusy()}
                            disabled={isLoadingBusy || !isGoogleCalendarConnected || isWaitingOnCandidate}
                            variant="ghost"
                            size="sm"
                        >
                            {isLoadingBusy ? 'Refreshing calendar...' : 'Refresh Google Calendar'}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setProposalMode((current) => !current)}
                            disabled={isWaitingOnCandidate}
                            variant="secondary"
                            size="sm"
                        >
                            {proposalMode ? 'Hide Proposal Calendar' : 'Propose Other Times'}
                        </Button>
                    </div>
                </div>

                {isWaitingOnCandidate ? (
                    <p className="text-sm text-gray-600">
                        Waiting for the candidate to respond to your latest proposal round.
                    </p>
                ) : null}

                {proposalMode && !isWaitingOnCandidate ? (
                    <>
                        <UnifiedWeeklyCalendar
                            mode="multi-toggle"
                            calendarTimezone={proposalCalendarTimezone}
                            counterpartTimezone={proposalCounterpartTimezone}
                            googleBusyIntervals={googleBusyIntervals}
                            initialSelectedSlots={proposalSlotsState}
                            referenceIntervals={confirmationSlots}
                            referenceClassName="calendar-slot-state-professional-reference-available"
                            selectedClassName="calendar-slot-state-professional-proposal-selected"
                            selectedBusyOverrideClassName="calendar-slot-state-professional-proposal-selected"
                            onSelectionChange={({ slots }) => setProposalSlotsState(slots)}
                            header={{
                                title: 'Proposal Calendar',
                                description: 'Candidate-available times stay visible in blue. Select orange slots to propose other times.',
                            }}
                            legends={[
                                { className: 'calendar-slot-state-professional-reference-available', label: 'Current candidate times' },
                                { className: 'calendar-slot-state-professional-proposal-selected', label: 'Proposed other times' },
                                { className: 'calendar-slot-state-candidate-google-busy', label: 'Busy on your Google Calendar' },
                            ]}
                        />

                        {proposalError ? (
                            <div className="text-red-600 text-sm p-2 bg-red-50 rounded">
                                {proposalError}
                            </div>
                        ) : null}

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                onClick={handleSubmitProposal}
                                disabled={isSubmittingProposal || proposalSlotsState.length === 0}
                            >
                                {isSubmittingProposal ? 'Sending...' : 'Send Proposed Times'}
                            </Button>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
