'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CandidateWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { countHalfHourSlots } from '@/components/bookings/calendar/interval-utils';
import { useCandidateGoogleBusy } from '@/components/bookings/hooks/useCandidateGoogleBusy';

interface CandidateAvailabilityPanelProps {
    calendarTimezone?: string;
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
        useCandidateGoogleBusy();

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
        <div className={className}>
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
                initialSelectedSlots={initialSelectedSlots}
                onChange={handleSelectionChange}
                calendarTimezone={resolvedCalendarTimezone}
                professionalTimezone={professionalTimezone}
                heading={heading}
                description={description}
                showClearAll={showClearAll}
            />

            <p className="text-sm text-gray-500 mt-4">
                {selectedCountLabel}: <span className="font-medium">{selectedSlotCount}</span>
            </p>

            {children}
        </div>
    );
}
