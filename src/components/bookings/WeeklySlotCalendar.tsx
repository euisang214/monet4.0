'use client';

import React from 'react';
import { format } from 'date-fns';
import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import { VISIBLE_END_ROW_EXCLUSIVE, VISIBLE_ROW_COUNT, VISIBLE_START_ROW } from '@/components/bookings/calendar/slot-utils';
import { WeekRangeNavigator, WeeklySlotGrid } from '@/components/bookings/calendar/WeeklySlotGrid';
import { baseSlotCellClasses, candidateSlotStateClasses, getProfessionalSlotClass } from '@/components/bookings/calendar/slot-styles';
import { useCandidateWeeklySlotSelection } from '@/components/bookings/hooks/useCandidateWeeklySlotSelection';
import { useProfessionalWeeklySlotSelection } from '@/components/bookings/hooks/useProfessionalWeeklySlotSelection';

export type { SlotInterval } from '@/components/bookings/calendar/types';

const DEFAULT_VIEW_START_ROW = VISIBLE_START_ROW;
const DEFAULT_VIEW_VISIBLE_ROWS = VISIBLE_ROW_COUNT;
const MIN_CALENDAR_VIEWPORT_HEIGHT = 320;

function useDefaultBusinessHoursViewport(anchor: Date | null) {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = React.useState(MIN_CALENDAR_VIEWPORT_HEIGHT);

    React.useLayoutEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const header = container.querySelector('thead');
        const sampleRow = container.querySelector<HTMLTableRowElement>(`tbody tr[data-slot-row="${VISIBLE_START_ROW}"]`);
        const startRow = container.querySelector<HTMLTableRowElement>(`tbody tr[data-slot-row="${DEFAULT_VIEW_START_ROW}"]`);

        if (!header || !sampleRow || !startRow) return;

        const rowHeight = sampleRow.getBoundingClientRect().height;
        const headerHeight = header.getBoundingClientRect().height;
        const nextHeight = Math.max(Math.round((rowHeight * DEFAULT_VIEW_VISIBLE_ROWS) + headerHeight), MIN_CALENDAR_VIEWPORT_HEIGHT);

        setViewportHeight((current) => (current === nextHeight ? current : nextHeight));
        container.scrollTop = Math.max(startRow.offsetTop - headerHeight, 0);
    }, [anchor]);

    return {
        scrollRef,
        viewportHeight,
    };
}

interface CandidateWeeklySlotPickerProps {
    googleBusyIntervals: SlotInterval[];
    onChange: (payload: { availabilitySlots: SlotInterval[]; selectedCount: number }) => void;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
}

export function CandidateWeeklySlotPicker({
    googleBusyIntervals,
    onChange,
    calendarTimezone,
    professionalTimezone,
}: CandidateWeeklySlotPickerProps) {
    const {
        weekStart,
        canGoPrev,
        canGoNext,
        selectedCount,
        getCellMeta,
        goToPreviousWeek,
        goToNextWeek,
        clearSelection,
        handleSlotPointerDown,
        handleSlotPointerEnter,
    } = useCandidateWeeklySlotSelection({
        googleBusyIntervals,
        onChange,
    });
    const { scrollRef, viewportHeight } = useDefaultBusinessHoursViewport(weekStart);
    const resolvedCalendarTimezone = React.useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );
    const showProfessionalTimezoneAxis =
        !!professionalTimezone && professionalTimezone !== resolvedCalendarTimezone;

    return (
        <section className="space-y-4">
            <header className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">Select Your Availability (30-minute slots)</h3>
                    <div className="text-sm text-gray-600">{selectedCount} slots selected</div>
                </div>
                <p className="text-sm text-gray-600">
                    Click or drag any 30-minute cell to toggle availability. You can override Google Calendar busy blocks.
                </p>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={clearSelection}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
                >
                    Clear All
                </button>

                <WeekRangeNavigator
                    weekStart={weekStart}
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                    onPrev={goToPreviousWeek}
                    onNext={goToNextWeek}
                    rangeLabelMinWidthClassName="min-w-[180px]"
                    calendarTimezone={resolvedCalendarTimezone}
                />
            </div>

            <WeeklySlotGrid
                weekStart={weekStart}
                scrollRef={scrollRef}
                viewportHeight={viewportHeight}
                tableClassName="select-none"
                visibleRowStart={VISIBLE_START_ROW}
                visibleRowEndExclusive={VISIBLE_END_ROW_EXCLUSIVE}
                calendarTimezone={resolvedCalendarTimezone}
                professionalTimezone={professionalTimezone}
                showProfessionalTimezoneAxis={showProfessionalTimezoneAxis}
                renderCell={({ slotStart }) => {
                    const cell = getCellMeta(slotStart);

                    return (
                        <td className="calendar-slot-grid-cell">
                            <button
                                type="button"
                                onPointerDown={(event) => {
                                    if (!cell.canInteract) return;
                                    event.preventDefault();
                                    handleSlotPointerDown(slotStart);
                                }}
                                onPointerEnter={() => {
                                    if (!cell.canInteract) return;
                                    handleSlotPointerEnter(slotStart);
                                }}
                                className={`${baseSlotCellClasses} ${candidateSlotStateClasses[cell.state]} ${cell.canInteract ? 'cursor-pointer' : ''}`}
                                disabled={!cell.canInteract}
                                title={format(slotStart, 'PPpp')}
                            />
                        </td>
                    );
                }}
            />

            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                    <span className="calendar-slot-legend-swatch calendar-slot-state-candidate-available" />
                    Available
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="calendar-slot-legend-swatch calendar-slot-state-candidate-google-busy" />
                    Busy on Google Calendar (click to override)
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="calendar-slot-legend-swatch calendar-slot-state-candidate-google-busy-overridden" />
                    Busy but overridden
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="calendar-slot-legend-swatch calendar-slot-state-candidate-blocked" />
                    Unselected
                </span>
            </div>
        </section>
    );
}

interface ProfessionalWeeklySlotPickerProps {
    slots: SlotInput[];
    selectedSlot: string | null;
    onSelect?: (slotStartIso: string) => void;
    readOnly?: boolean;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
}

export function ProfessionalWeeklySlotPicker({
    slots,
    selectedSlot,
    onSelect,
    readOnly = false,
    calendarTimezone,
    professionalTimezone,
}: ProfessionalWeeklySlotPickerProps) {
    const resolvedCalendarTimezone = React.useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );
    const {
        weekStart,
        hasSlots,
        canGoPrev,
        canGoNext,
        goToPreviousWeek,
        goToNextWeek,
        getCellMeta,
    } = useProfessionalWeeklySlotSelection({
        slots,
        selectedSlot,
        calendarTimezone: resolvedCalendarTimezone,
    });
    const { scrollRef, viewportHeight } = useDefaultBusinessHoursViewport(weekStart);
    const showProfessionalTimezoneAxis =
        !!professionalTimezone && professionalTimezone !== resolvedCalendarTimezone;

    if (!hasSlots || !weekStart) {
        return (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                {readOnly
                    ? 'No availability slots found in your calendar window.'
                    : 'No overlapping slots found. Ask the candidate to share additional times.'}
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-gray-900">
                    {readOnly ? 'Your availability calendar' : 'Choose from candidate-submitted times'}
                </h3>
                <WeekRangeNavigator
                    weekStart={weekStart}
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                    onPrev={goToPreviousWeek}
                    onNext={goToNextWeek}
                    calendarTimezone={resolvedCalendarTimezone}
                />
            </div>

            <WeeklySlotGrid
                weekStart={weekStart}
                scrollRef={scrollRef}
                viewportHeight={viewportHeight}
                visibleRowStart={VISIBLE_START_ROW}
                visibleRowEndExclusive={VISIBLE_END_ROW_EXCLUSIVE}
                calendarTimezone={resolvedCalendarTimezone}
                professionalTimezone={professionalTimezone}
                showProfessionalTimezoneAxis={showProfessionalTimezoneAxis}
                renderCell={({ slotStart }) => {
                    const cell = getCellMeta(slotStart);
                    const canSelect = cell.isSelectable && !readOnly && !!onSelect;
                    const cellClass = getProfessionalSlotClass({
                        isSelected: cell.isSelected,
                        isSelectable: cell.isSelectable,
                        canSelect,
                        readOnly,
                    });

                    return (
                        <td className="calendar-slot-grid-cell">
                            <button
                                type="button"
                                onClick={() => {
                                    if (canSelect && onSelect) onSelect(cell.key);
                                }}
                                className={`${baseSlotCellClasses} ${cellClass} ${canSelect ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                title={format(slotStart, 'PPpp')}
                            />
                        </td>
                    );
                }}
            />

            <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                    <span
                        className={`calendar-slot-legend-swatch ${
                            readOnly ? 'calendar-slot-state-professional-readonly' : 'calendar-slot-state-professional-selectable'
                        }`}
                    />
                    {readOnly ? 'Available' : 'Can choose'}
                </span>
                {!readOnly && (
                    <span className="inline-flex items-center gap-2">
                        <span className="calendar-slot-legend-swatch calendar-slot-state-professional-selected" />
                        Selected slot
                    </span>
                )}
                {!readOnly && (
                    <span className="inline-flex items-center gap-2">
                        <span className="calendar-slot-legend-swatch calendar-slot-state-professional-unavailable" />
                        Unavailable
                    </span>
                )}
            </div>
        </section>
    );
}
