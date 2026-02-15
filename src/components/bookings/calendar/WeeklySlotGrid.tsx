'use client';

import React from 'react';
import { addDays, format } from 'date-fns';
import { SLOTS_PER_DAY, getSlotLabel, slotDateForCell } from '@/components/bookings/calendar/slot-utils';

interface WeekRangeNavigatorProps {
    weekStart: Date;
    canGoPrev: boolean;
    canGoNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    rangeLabelMinWidthClassName?: string;
}

export function WeekRangeNavigator({
    weekStart,
    canGoPrev,
    canGoNext,
    onPrev,
    onNext,
    rangeLabelMinWidthClassName = 'min-w-[170px]',
}: WeekRangeNavigatorProps) {
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onPrev}
                disabled={!canGoPrev}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40"
            >
                Previous week
            </button>
            <span className={`text-sm text-gray-700 ${rangeLabelMinWidthClassName} text-center`}>
                {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
            </span>
            <button
                type="button"
                onClick={onNext}
                disabled={!canGoNext}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40"
            >
                Next week
            </button>
        </div>
    );
}

interface WeeklySlotGridProps {
    weekStart: Date;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    viewportHeight: number;
    tableClassName?: string;
    renderCell: (args: { slotStart: Date; dayOffset: number; row: number }) => React.ReactNode;
}

export function WeeklySlotGrid({
    weekStart,
    scrollRef,
    viewportHeight,
    tableClassName = 'w-full border-collapse table-fixed',
    renderCell,
}: WeeklySlotGridProps) {
    return (
        <div
            ref={scrollRef}
            className="overflow-y-auto border border-gray-200 rounded-lg bg-white"
            style={{ height: `${viewportHeight}px` }}
        >
            <table className={tableClassName}>
                <thead>
                    <tr>
                        <th
                            className="w-20 border-b border-gray-200 bg-gray-50 sticky left-0"
                            style={{ top: 0, zIndex: 30, backgroundColor: '#ffffff' }}
                        />
                        {Array.from({ length: 7 }).map((_, dayOffset) => {
                            const day = addDays(weekStart, dayOffset);
                            return (
                                <th
                                    key={day.toISOString()}
                                    className="border-b border-gray-200 py-2 text-xs font-semibold text-gray-700 sticky"
                                    style={{ top: 0, zIndex: 20, backgroundColor: '#ffffff' }}
                                >
                                    {format(day, 'EEE MMM d')}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: SLOTS_PER_DAY }).map((_, row) => (
                        <tr key={row} data-slot-row={row}>
                            <td
                                className="sticky left-0 border-r border-gray-200 bg-gray-50 pr-2 align-top text-right text-[11px] text-gray-500"
                                style={{ zIndex: 10, backgroundColor: '#ffffff' }}
                            >
                                {getSlotLabel(row)}
                            </td>
                            {Array.from({ length: 7 }).map((__, dayOffset) => {
                                const slotStart = slotDateForCell(weekStart, dayOffset, row);

                                return (
                                    <React.Fragment key={`${dayOffset}-${row}`}>
                                        {renderCell({ slotStart, dayOffset, row })}
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
