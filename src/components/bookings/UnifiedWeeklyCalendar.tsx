'use client';

import React from 'react';
import { format } from 'date-fns';
import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import {
    VISIBLE_END_ROW_EXCLUSIVE,
    VISIBLE_ROW_COUNT,
    VISIBLE_START_ROW,
} from '@/components/bookings/calendar/slot-utils';
import { WeekRangeNavigator, WeeklySlotGrid } from '@/components/bookings/calendar/WeeklySlotGrid';
import {
    baseSlotCellClasses,
    candidateSlotStateClasses,
    getProfessionalSlotClass,
} from '@/components/bookings/calendar/slot-styles';
import {
    useUnifiedWeeklyCalendarState,
    type UnifiedMultiToggleState,
    type UnifiedSingleSelectState,
} from '@/components/bookings/hooks/useUnifiedWeeklyCalendarState';

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
        const nextHeight = Math.max(
            Math.round((rowHeight * DEFAULT_VIEW_VISIBLE_ROWS) + headerHeight),
            MIN_CALENDAR_VIEWPORT_HEIGHT
        );

        setViewportHeight((current) => (current === nextHeight ? current : nextHeight));
        container.scrollTop = Math.max(startRow.offsetTop - headerHeight, 0);
    }, [anchor]);

    return {
        scrollRef,
        viewportHeight,
    };
}

export interface LegendItem {
    className: string;
    label: string;
}

type MultiToggleProps = {
    mode: 'multi-toggle';
    calendarTimezone?: string;
    counterpartTimezone?: string | null;
    googleBusyIntervals: SlotInterval[];
    initialSelectedSlots?: SlotInterval[];
    onSelectionChange: (payload: { slots: SlotInterval[]; selectedCount: number }) => void;
    header: { title: string; description: string };
    showClearAll?: boolean;
    legends?: LegendItem[];
};

type SingleSelectProps = {
    mode: 'single-select';
    calendarTimezone?: string;
    counterpartTimezone?: string | null;
    selectableSlots: SlotInput[];
    selectedSlot: string | null;
    onSelect?: (slotIso: string) => void;
    readOnly?: boolean;
    header: { title: string };
    legends?: LegendItem[];
};

export type UnifiedWeeklyCalendarProps = MultiToggleProps | SingleSelectProps;

const DEFAULT_MULTI_LEGENDS: LegendItem[] = [
    { className: 'calendar-slot-state-candidate-available', label: 'Available' },
    { className: 'calendar-slot-state-candidate-google-busy', label: 'Busy on Google Calendar (click to override)' },
    { className: 'calendar-slot-state-candidate-google-busy-overridden', label: 'Busy but overridden' },
    { className: 'calendar-slot-state-candidate-blocked', label: 'Unselected' },
];

const DEFAULT_SINGLE_SELECT_LEGENDS: LegendItem[] = [
    { className: 'calendar-slot-state-professional-selectable', label: 'Can choose' },
    { className: 'calendar-slot-state-professional-selected', label: 'Selected slot' },
    { className: 'calendar-slot-state-professional-unavailable', label: 'Unavailable' },
];

const DEFAULT_SINGLE_READONLY_LEGENDS: LegendItem[] = [
    { className: 'calendar-slot-state-professional-readonly', label: 'Available' },
];

export function UnifiedWeeklyCalendar(props: UnifiedWeeklyCalendarProps) {
    const resolvedCalendarTimezone = React.useMemo(
        () => props.calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [props.calendarTimezone]
    );
    const showCounterpartTimezoneAxis =
        !!props.counterpartTimezone && props.counterpartTimezone !== resolvedCalendarTimezone;

    const state = useUnifiedWeeklyCalendarState(
        props.mode === 'multi-toggle'
            ? {
                mode: 'multi-toggle',
                googleBusyIntervals: props.googleBusyIntervals,
                initialSelectedSlots: props.initialSelectedSlots,
                onSelectionChange: props.onSelectionChange,
            }
            : {
                mode: 'single-select',
                slots: props.selectableSlots,
                selectedSlot: props.selectedSlot,
                calendarTimezone: resolvedCalendarTimezone,
            }
    );

    const { scrollRef, viewportHeight } = useDefaultBusinessHoursViewport(state.weekStart);

    if (props.mode === 'single-select') {
        const singleState = state as UnifiedSingleSelectState;

        if (!singleState.hasSlots || !singleState.weekStart) {
            return (
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                    {props.readOnly
                        ? 'No availability slots found in your calendar window.'
                        : 'No overlapping slots found. Ask the candidate to share additional times.'}
                </div>
            );
        }

        const legends =
            props.legends || (props.readOnly ? DEFAULT_SINGLE_READONLY_LEGENDS : DEFAULT_SINGLE_SELECT_LEGENDS);

        return (
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-medium text-gray-900">{props.header.title}</h3>
                    <WeekRangeNavigator
                        weekStart={singleState.weekStart}
                        canGoPrev={singleState.canGoPrev}
                        canGoNext={singleState.canGoNext}
                        onPrev={singleState.goToPreviousWeek}
                        onNext={singleState.goToNextWeek}
                        calendarTimezone={resolvedCalendarTimezone}
                    />
                </div>

                <WeeklySlotGrid
                    weekStart={singleState.weekStart}
                    scrollRef={scrollRef}
                    viewportHeight={viewportHeight}
                    visibleRowStart={VISIBLE_START_ROW}
                    visibleRowEndExclusive={VISIBLE_END_ROW_EXCLUSIVE}
                    calendarTimezone={resolvedCalendarTimezone}
                    professionalTimezone={props.counterpartTimezone}
                    showProfessionalTimezoneAxis={showCounterpartTimezoneAxis}
                    renderCell={({ slotStart }) => {
                        const cell = singleState.getCellMeta(slotStart);
                        const canSelect = cell.isSelectable && !props.readOnly && !!props.onSelect;
                        const cellClass = getProfessionalSlotClass({
                            isSelected: cell.isSelected,
                            isSelectable: cell.isSelectable,
                            canSelect,
                            readOnly: props.readOnly || false,
                        });

                        return (
                            <td className="calendar-slot-grid-cell">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (canSelect && props.onSelect) props.onSelect(cell.key);
                                    }}
                                    className={`${baseSlotCellClasses} ${cellClass} ${canSelect ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                    title={format(slotStart, 'PPpp')}
                                />
                            </td>
                        );
                    }}
                />

                <div className="flex items-center gap-4 text-xs text-gray-600">
                    {legends.map((legend) => (
                        <span key={legend.label} className="inline-flex items-center gap-2">
                            <span className={`calendar-slot-legend-swatch ${legend.className}`} />
                            {legend.label}
                        </span>
                    ))}
                </div>
            </section>
        );
    }

    const legends = props.legends || DEFAULT_MULTI_LEGENDS;
    const multiState = state as UnifiedMultiToggleState;

    return (
        <section className="space-y-4">
            <header className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{props.header.title}</h3>
                    <div className="text-sm text-gray-600">{multiState.selectedCount} slots selected</div>
                </div>
                <p className="text-sm text-gray-600">{props.header.description}</p>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
                {(props.showClearAll ?? true) && (
                    <button
                        type="button"
                        onClick={multiState.clearSelection}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
                    >
                        Clear All
                    </button>
                )}

                <WeekRangeNavigator
                    weekStart={multiState.weekStart}
                    canGoPrev={multiState.canGoPrev}
                    canGoNext={multiState.canGoNext}
                    onPrev={multiState.goToPreviousWeek}
                    onNext={multiState.goToNextWeek}
                    rangeLabelMinWidthClassName="min-w-[180px]"
                    calendarTimezone={resolvedCalendarTimezone}
                />
            </div>

            <WeeklySlotGrid
                weekStart={multiState.weekStart}
                scrollRef={scrollRef}
                viewportHeight={viewportHeight}
                tableClassName="select-none"
                visibleRowStart={VISIBLE_START_ROW}
                visibleRowEndExclusive={VISIBLE_END_ROW_EXCLUSIVE}
                calendarTimezone={resolvedCalendarTimezone}
                professionalTimezone={props.counterpartTimezone}
                showProfessionalTimezoneAxis={showCounterpartTimezoneAxis}
                renderCell={({ slotStart }) => {
                    const cell = multiState.getCellMeta(slotStart);

                    return (
                        <td className="calendar-slot-grid-cell">
                            <button
                                type="button"
                                onPointerDown={(event) => {
                                    if (!cell.canInteract) return;
                                    event.preventDefault();
                                    multiState.handleSlotPointerDown(slotStart);
                                }}
                                onPointerEnter={() => {
                                    if (!cell.canInteract) return;
                                    multiState.handleSlotPointerEnter(slotStart);
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
                {legends.map((legend) => (
                    <span key={legend.label} className="inline-flex items-center gap-2">
                        <span className={`calendar-slot-legend-swatch ${legend.className}`} />
                        {legend.label}
                    </span>
                ))}
            </div>
        </section>
    );
}
