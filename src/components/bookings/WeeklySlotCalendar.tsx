'use client';

import React from 'react';
import { format } from 'date-fns';
import type { SlotCellState, SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import { SLOT_MINUTES } from '@/components/bookings/calendar/slot-utils';
import { WeekRangeNavigator, WeeklySlotGrid } from '@/components/bookings/calendar/WeeklySlotGrid';
import { useCandidateWeeklySlotSelection } from '@/components/bookings/hooks/useCandidateWeeklySlotSelection';
import { useProfessionalWeeklySlotSelection } from '@/components/bookings/hooks/useProfessionalWeeklySlotSelection';

export type { SlotInterval } from '@/components/bookings/calendar/types';

const baseCellClasses = 'h-5 w-full border border-gray-100 transition-colors';
const DEFAULT_VIEW_START_HOUR = 9;
const DEFAULT_VIEW_END_HOUR = 18;
const DEFAULT_VIEW_START_ROW = (DEFAULT_VIEW_START_HOUR * 60) / SLOT_MINUTES;
const DEFAULT_VIEW_VISIBLE_ROWS = ((DEFAULT_VIEW_END_HOUR - DEFAULT_VIEW_START_HOUR) * 60) / SLOT_MINUTES;
const MIN_CALENDAR_VIEWPORT_HEIGHT = 320;

function useDefaultBusinessHoursViewport(anchor: Date | null) {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [viewportHeight, setViewportHeight] = React.useState(MIN_CALENDAR_VIEWPORT_HEIGHT);

    React.useLayoutEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        const header = container.querySelector('thead');
        const sampleRow = container.querySelector<HTMLTableRowElement>('tbody tr[data-slot-row="0"]');
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

const candidateStateClasses: Record<SlotCellState, string> = {
    available: 'bg-green-300 hover:bg-green-400',
    blocked: 'bg-gray-50 hover:bg-gray-100',
    'google-busy': 'bg-red-100 text-red-600 hover:bg-red-200',
    'google-busy-overridden': 'bg-orange-300 hover:bg-orange-400',
    disabled: 'bg-gray-100 cursor-not-allowed opacity-70',
};

interface CandidateWeeklySlotPickerProps {
    googleBusyIntervals: SlotInterval[];
    onChange: (payload: { availabilitySlots: SlotInterval[]; selectedCount: number }) => void;
}

export function CandidateWeeklySlotPicker({ googleBusyIntervals, onChange }: CandidateWeeklySlotPickerProps) {
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

    return (
        <section className="space-y-4">
            <header className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">Select your availability (30-minute slots)</h3>
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
                    Clear all
                </button>

                <WeekRangeNavigator
                    weekStart={weekStart}
                    canGoPrev={canGoPrev}
                    canGoNext={canGoNext}
                    onPrev={goToPreviousWeek}
                    onNext={goToNextWeek}
                    rangeLabelMinWidthClassName="min-w-[180px]"
                />
            </div>

            <WeeklySlotGrid
                weekStart={weekStart}
                scrollRef={scrollRef}
                viewportHeight={viewportHeight}
                tableClassName="w-full border-collapse table-fixed select-none"
                renderCell={({ slotStart }) => {
                    const cell = getCellMeta(slotStart);

                    return (
                        <td className="p-0">
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
                                className={`${baseCellClasses} ${candidateStateClasses[cell.state]}`}
                                disabled={!cell.canInteract}
                                title={format(slotStart, 'PPpp')}
                            />
                        </td>
                    );
                }}
            />

            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-green-300 border border-green-400" />
                    Available
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-red-100 border border-red-200" />
                    Busy on Google Calendar (click to override)
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-orange-300 border border-orange-400" />
                    Busy but overridden
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-gray-50 border border-gray-200" />
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
}

export function ProfessionalWeeklySlotPicker({ slots, selectedSlot, onSelect, readOnly = false }: ProfessionalWeeklySlotPickerProps) {
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
    });
    const { scrollRef, viewportHeight } = useDefaultBusinessHoursViewport(weekStart);

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
                />
            </div>

            <WeeklySlotGrid
                weekStart={weekStart}
                scrollRef={scrollRef}
                viewportHeight={viewportHeight}
                renderCell={({ slotStart }) => {
                    const cell = getCellMeta(slotStart);
                    const canSelect = cell.isSelectable && !readOnly && !!onSelect;

                    const cellClass = cell.isSelected
                        ? 'bg-blue-500 text-white border-blue-600'
                        : cell.isSelectable
                            ? canSelect
                                ? 'bg-green-100 hover:bg-green-200 border-green-200'
                                : 'bg-green-100 border-green-200'
                            : 'bg-gray-50 border-gray-100';

                    return (
                        <td className="p-0">
                            <button
                                type="button"
                                onClick={() => {
                                    if (canSelect && onSelect) onSelect(cell.key);
                                }}
                                className={`h-5 w-full border transition-colors ${cellClass} ${!canSelect ? 'cursor-default' : ''}`}
                                title={format(slotStart, 'PPpp')}
                            />
                        </td>
                    );
                }}
            />

            <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-green-100 border border-green-200" />
                    {readOnly ? 'Available' : 'Candidate available'}
                </span>
                {!readOnly && (
                    <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-sm bg-blue-500 border border-blue-600" />
                        Selected slot
                    </span>
                )}
            </div>
        </section>
    );
}
