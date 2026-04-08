'use client';

import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BookingFlowShell, type BookingFlowStep } from '@/components/bookings/BookingFlowShell';
import { Button } from '@/components/ui/primitives/Button';
import { SurfaceCard } from '@/components/ui/composites/SurfaceCard/SurfaceCard';
import { ProfessionalWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';
import styles from './SlotPickerForm.module.css';

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
    workflowTitle?: string;
    workflowDescription?: string;
    steps?: BookingFlowStep[];
    summaryTitle?: string;
    summaryFooter?: React.ReactNode;
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
    workflowTitle,
    workflowDescription,
    steps,
    summaryTitle = 'Selection summary',
    summaryFooter,
}: SlotPickerFormProps) {
    const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
    const selectedSlotLabel = useMemo(() => {
        if (!selectedSlot) return 'Choose a time to continue';
        return format(new Date(selectedSlot), 'EEEE, MMM d · h:mm a');
    }, [selectedSlot]);
    const workflowSteps = useMemo<BookingFlowStep[]>(
        () =>
            steps || [
                {
                    label: 'Review available times',
                    description: 'Scan the candidate-provided options before selecting one.',
                    status: 'current',
                },
                {
                    label: 'Confirm schedule',
                    description: 'Submit the selected slot to finalize the next step.',
                    status: 'upcoming',
                },
            ],
        [steps]
    );

    const handleConfirm = () => {
        if (!selectedSlot) return;
        onConfirm(selectedSlot);
    };

    return (
        <BookingFlowShell
            title={workflowTitle}
            description={workflowDescription}
            steps={workflowSteps}
            summaryTitle={summaryTitle}
            summaryDescription="Keep the important context visible while you make a scheduling decision."
            summary={
                <div className={styles.summaryList}>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Available options</span>
                        <span className={styles.summaryValue}>{slots.length} slots</span>
                    </div>
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Selected time</span>
                        <span className={styles.summaryValue}>{selectedSlotLabel}</span>
                    </div>
                    {calendarTimezone ? (
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Calendar timezone</span>
                            <span className={styles.summaryValue}>{calendarTimezone}</span>
                        </div>
                    ) : null}
                    {professionalTimezone ? (
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Counterpart timezone</span>
                            <span className={styles.summaryValue}>{professionalTimezone}</span>
                        </div>
                    ) : null}
                </div>
            }
            summaryFooter={summaryFooter}
            className={styles.surface}
        >
            <SurfaceCard className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.copy}>
                        <h3 className={styles.title}>{heading}</h3>
                        <p className={styles.description}>{description}</p>
                    </div>
                    <span className={styles.slotCount}>{slots.length} options</span>
                </div>

                <ProfessionalWeeklySlotPicker
                    slots={slots}
                    selectedSlot={selectedSlot}
                    onSelect={(slot) => setSelectedSlot(slot)}
                    calendarTimezone={calendarTimezone}
                    professionalTimezone={professionalTimezone}
                />

                {error ? <div className={styles.error}>{error}</div> : null}

                <div className={styles.actions}>
                    {secondaryAction ? (
                        <Button
                            type="button"
                            onClick={secondaryAction.onClick}
                            disabled={secondaryAction.isLoading || isConfirming}
                            variant="danger"
                        >
                            {secondaryAction.isLoading ? secondaryAction.loadingLabel : secondaryAction.label}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!selectedSlot || isConfirming || isDisabled}
                        variant="primary"
                    >
                        {isConfirming ? confirmingLabel : confirmLabel}
                    </Button>
                </div>
            </SurfaceCard>
        </BookingFlowShell>
    );
}
