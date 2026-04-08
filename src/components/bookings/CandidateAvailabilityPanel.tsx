'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CandidateWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { countHalfHourSlots } from '@/components/bookings/calendar/interval-utils';
import { useCandidateGoogleBusy } from '@/components/bookings/hooks/useCandidateGoogleBusy';
import { Button } from '@/components/ui/primitives/Button';
import { cn } from '@/lib/ui/cn';
import styles from './CandidateAvailabilityPanel.module.css';

interface CandidateAvailabilityPanelProps {
    calendarTimezone?: string;
    isGoogleCalendarConnected: boolean;
    professionalTimezone?: string | null;
    initialSelectedSlots?: SlotInterval[];
    onSelectionChange: (payload: { availabilitySlots: SlotInterval[]; selectedCount: number }) => void;
    selectedCountLabel?: string;
    className?: string;
    heading?: string;
    description?: string;
    showClearAll?: boolean;
    children?: React.ReactNode;
}

export function CandidateAvailabilityPanel({
    calendarTimezone,
    isGoogleCalendarConnected,
    professionalTimezone,
    initialSelectedSlots = [],
    onSelectionChange,
    selectedCountLabel = 'Selected candidate slots',
    className = '',
    heading,
    description,
    showClearAll = true,
    children,
}: CandidateAvailabilityPanelProps) {
    const [selectedSlotCount, setSelectedSlotCount] = useState(() => countHalfHourSlots(initialSelectedSlots));
    const resolvedCalendarTimezone = useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );
    const { googleBusyIntervals, isLoadingBusy, busyLoadError, lastBusyRefreshAt, refreshGoogleBusy } =
        useCandidateGoogleBusy({ autoLoad: isGoogleCalendarConnected });

    const handleSelectionChange = useCallback(
        ({ availabilitySlots, selectedCount }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setSelectedSlotCount(selectedCount);
            onSelectionChange({ availabilitySlots, selectedCount });
        },
        [onSelectionChange]
    );

    useEffect(() => {
        setSelectedSlotCount(countHalfHourSlots(initialSelectedSlots));
    }, [initialSelectedSlots]);

    return (
        <div className={cn(styles.panel, className)}>
            <div className={styles.toolbar}>
                <div className={styles.toolbarMeta}>
                    <span className={styles.selectionPill}>
                        {selectedCountLabel} <strong>{selectedSlotCount}</strong>
                    </span>
                    {lastBusyRefreshAt ? (
                        <span className={styles.syncStatus}>
                            Last synced {lastBusyRefreshAt.toLocaleTimeString()}
                        </span>
                    ) : (
                        <span className={styles.syncStatus}>
                            {isGoogleCalendarConnected ? 'Google Calendar ready to sync' : 'Google Calendar not connected'}
                        </span>
                    )}
                </div>
                <Button
                    type="button"
                    onClick={() => {
                        if (!isGoogleCalendarConnected) return;
                        void refreshGoogleBusy();
                    }}
                    disabled={isLoadingBusy || !isGoogleCalendarConnected}
                    variant="ghost"
                    size="sm"
                >
                    {isLoadingBusy ? 'Refreshing calendar...' : 'Refresh Google Calendar'}
                </Button>
            </div>

            {busyLoadError && (
                <div className={styles.warning}>
                    {busyLoadError}
                </div>
            )}

            <CandidateWeeklySlotPicker
                googleBusyIntervals={googleBusyIntervals}
                initialSelectedSlots={initialSelectedSlots}
                onChange={handleSelectionChange}
                calendarTimezone={resolvedCalendarTimezone}
                professionalTimezone={professionalTimezone}
                heading={heading}
                description={description}
                showClearAll={showClearAll}
            />

            {children}
        </div>
    );
}
