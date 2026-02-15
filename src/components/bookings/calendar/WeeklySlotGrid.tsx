'use client';

import React from 'react';
import {
    VISIBLE_END_ROW_EXCLUSIVE,
    VISIBLE_START_ROW,
    getDayHeaderLabel,
    getSlotLabel,
    getWeekRangeLabel,
    slotDateForCell,
} from '@/components/bookings/calendar/slot-utils';

const DAY_OFFSETS = [0, 1, 2, 3, 4, 5, 6];
const AXIS_COLUMN_WIDTH = '6.75rem';
const LEFT_AXIS_LABEL_STYLE = { height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' } as const;
const RIGHT_AXIS_LABEL_STYLE = { height: '20px', display: 'flex', alignItems: 'center' } as const;

interface WeekRangeNavigatorProps {
    weekStart: Date;
    canGoPrev: boolean;
    canGoNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    rangeLabelMinWidthClassName?: string;
    calendarTimezone?: string;
}

export function WeekRangeNavigator({
    weekStart,
    canGoPrev,
    canGoNext,
    onPrev,
    onNext,
    rangeLabelMinWidthClassName = 'min-w-[170px]',
    calendarTimezone,
}: WeekRangeNavigatorProps) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onPrev}
                disabled={!canGoPrev}
                aria-label="Previous week"
                className="calendar-week-nav-button"
            >
                <span aria-hidden="true" className="calendar-week-nav-arrow">‹</span>
            </button>
            <span className={`calendar-week-range-label ${rangeLabelMinWidthClassName}`}>
                {getWeekRangeLabel(weekStart, calendarTimezone)}
            </span>
            <button
                type="button"
                onClick={onNext}
                disabled={!canGoNext}
                aria-label="Next week"
                className="calendar-week-nav-button"
            >
                <span aria-hidden="true" className="calendar-week-nav-arrow">›</span>
            </button>
        </div>
    );
}

interface WeeklySlotGridProps {
    weekStart: Date;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    viewportHeight: number;
    tableClassName?: string;
    visibleRowStart?: number;
    visibleRowEndExclusive?: number;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    showProfessionalTimezoneAxis?: boolean;
    renderCell: (args: { slotStart: Date; dayOffset: number; row: number }) => React.ReactNode;
}

type SlotRowModel = {
    row: number;
    slotStarts: Date[];
    leftAxisLabel: string;
    rightAxisLabel: string;
};

type WeeklyGridModelArgs = {
    weekStart: Date;
    visibleRowStart: number;
    visibleRowEndExclusive: number;
    calendarTimezone: string;
    professionalTimezone?: string | null;
    hasProfessionalAxis: boolean;
};

type CachedWeeklyGridModel = {
    key: string;
    dayHeaderLabels: string[];
    rowModels: SlotRowModel[];
};

let cachedWeeklyGridModel: CachedWeeklyGridModel | null = null;

function getWeeklyGridModel({
    weekStart,
    visibleRowStart,
    visibleRowEndExclusive,
    calendarTimezone,
    professionalTimezone,
    hasProfessionalAxis,
}: WeeklyGridModelArgs): CachedWeeklyGridModel {
    const cacheKey = [
        weekStart.getTime(),
        visibleRowStart,
        visibleRowEndExclusive,
        calendarTimezone,
        hasProfessionalAxis ? professionalTimezone || '' : '',
        hasProfessionalAxis ? 1 : 0,
    ].join('|');

    if (cachedWeeklyGridModel?.key === cacheKey) return cachedWeeklyGridModel;

    const rowCount = Math.max(0, visibleRowEndExclusive - visibleRowStart);
    const rows = Array.from({ length: rowCount }, (_, index) => visibleRowStart + index);
    const dayHeaderLabels = DAY_OFFSETS.map((dayOffset) => getDayHeaderLabel(weekStart, dayOffset, calendarTimezone));
    const rowModels = rows.map((row) => ({
        row,
        slotStarts: DAY_OFFSETS.map((dayOffset) => slotDateForCell(weekStart, dayOffset, row, calendarTimezone)),
        leftAxisLabel: getSlotLabel(row, calendarTimezone, weekStart),
        rightAxisLabel: hasProfessionalAxis
            ? getSlotLabel(row, professionalTimezone || undefined, weekStart, calendarTimezone)
            : '',
    }));

    const nextModel: CachedWeeklyGridModel = {
        key: cacheKey,
        dayHeaderLabels,
        rowModels,
    };

    cachedWeeklyGridModel = nextModel;
    return nextModel;
}

export function WeeklySlotGrid({
    weekStart,
    scrollRef,
    viewportHeight,
    tableClassName = '',
    visibleRowStart = VISIBLE_START_ROW,
    visibleRowEndExclusive = VISIBLE_END_ROW_EXCLUSIVE,
    calendarTimezone = 'UTC',
    professionalTimezone,
    showProfessionalTimezoneAxis = false,
    renderCell,
}: WeeklySlotGridProps) {
    const hasProfessionalAxis =
        showProfessionalTimezoneAxis && !!professionalTimezone && professionalTimezone !== calendarTimezone;
    const { dayHeaderLabels, rowModels } = getWeeklyGridModel({
        weekStart,
        visibleRowStart,
        visibleRowEndExclusive,
        calendarTimezone,
        professionalTimezone,
        hasProfessionalAxis,
    });

    return (
        <div
            ref={scrollRef}
            className="calendar-slot-grid-shell"
            style={{ height: `${viewportHeight}px` }}
        >
            <table className={`calendar-slot-grid-table ${tableClassName}`.trim()}>
                <colgroup>
                    <col style={{ width: AXIS_COLUMN_WIDTH }} />
                    {DAY_OFFSETS.map((index) => (
                        <col key={`day-col-${index}`} />
                    ))}
                    {hasProfessionalAxis && <col style={{ width: AXIS_COLUMN_WIDTH }} />}
                </colgroup>
                <thead>
                    <tr>
                        <th
                            className="calendar-slot-grid-header-axis calendar-slot-grid-header-axis-left sticky"
                            style={{ top: 0, zIndex: 30 }}
                        >
                            {calendarTimezone}
                        </th>
                        {DAY_OFFSETS.map((dayOffset) => {
                            return (
                                <th
                                    key={`day-header-${dayOffset}`}
                                    className="calendar-slot-grid-header-day sticky"
                                    style={{ top: 0, zIndex: 20 }}
                                >
                                    {dayHeaderLabels[dayOffset]}
                                </th>
                            );
                        })}
                        {hasProfessionalAxis && (
                            <th
                                className="calendar-slot-grid-header-axis calendar-slot-grid-header-axis-right"
                                style={{ top: 0, zIndex: 20 }}
                            >
                                {professionalTimezone}
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {rowModels.map((rowModel) => (
                        <tr key={rowModel.row} data-slot-row={rowModel.row}>
                            <td
                                className="calendar-slot-grid-time-axis sticky"
                                style={{ zIndex: 10 }}
                            >
                                <div style={LEFT_AXIS_LABEL_STYLE}>
                                    {rowModel.leftAxisLabel}
                                </div>
                            </td>
                            {rowModel.slotStarts.map((slotStart, dayOffset) => (
                                <React.Fragment key={`${dayOffset}-${rowModel.row}`}>
                                    {renderCell({ slotStart, dayOffset, row: rowModel.row })}
                                </React.Fragment>
                            ))}
                            {hasProfessionalAxis && (
                                <td className="calendar-slot-grid-time-axis-right">
                                    <div style={RIGHT_AXIS_LABEL_STYLE}>
                                        {rowModel.rightAxisLabel}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
