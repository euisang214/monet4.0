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
    const rowCount = Math.max(0, visibleRowEndExclusive - visibleRowStart);
    const rows = Array.from({ length: rowCount }, (_, index) => visibleRowStart + index);
    const hasProfessionalAxis =
        showProfessionalTimezoneAxis && !!professionalTimezone && professionalTimezone !== calendarTimezone;
    const axisColumnWidth = '6.75rem';

    return (
        <div
            ref={scrollRef}
            className="calendar-slot-grid-shell"
            style={{ height: `${viewportHeight}px` }}
        >
            <table className={`calendar-slot-grid-table ${tableClassName}`.trim()}>
                <colgroup>
                    <col style={{ width: axisColumnWidth }} />
                    {Array.from({ length: 7 }).map((_, index) => (
                        <col key={`day-col-${index}`} />
                    ))}
                    {hasProfessionalAxis && <col style={{ width: axisColumnWidth }} />}
                </colgroup>
                <thead>
                    <tr>
                        <th
                            className="calendar-slot-grid-header-axis calendar-slot-grid-header-axis-left sticky"
                            style={{ top: 0, zIndex: 30 }}
                        >
                            {calendarTimezone}
                        </th>
                        {Array.from({ length: 7 }).map((_, dayOffset) => {
                            return (
                                <th
                                    key={`day-header-${dayOffset}`}
                                    className="calendar-slot-grid-header-day sticky"
                                    style={{ top: 0, zIndex: 20 }}
                                >
                                    {getDayHeaderLabel(weekStart, dayOffset, calendarTimezone)}
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
                    {rows.map((row) => (
                        <tr key={row} data-slot-row={row}>
                            <td
                                className="calendar-slot-grid-time-axis sticky"
                                style={{ zIndex: 10 }}
                            >
                                <div style={{ height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                    {getSlotLabel(row, calendarTimezone, weekStart)}
                                </div>
                            </td>
                            {Array.from({ length: 7 }).map((__, dayOffset) => {
                                const slotStart = slotDateForCell(weekStart, dayOffset, row, calendarTimezone);

                                return (
                                    <React.Fragment key={`${dayOffset}-${row}`}>
                                        {renderCell({ slotStart, dayOffset, row })}
                                    </React.Fragment>
                                );
                            })}
                            {hasProfessionalAxis && (
                                <td className="calendar-slot-grid-time-axis-right">
                                    <div style={{ height: '20px', display: 'flex', alignItems: 'center' }}>
                                        {getSlotLabel(row, professionalTimezone || undefined, weekStart, calendarTimezone)}
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
