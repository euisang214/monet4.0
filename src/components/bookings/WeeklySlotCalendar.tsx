'use client';

import React from 'react';
import { addDays, format } from 'date-fns';
import type { SlotCellState, SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import { SLOTS_PER_DAY, getSlotLabel, slotDateForCell } from '@/components/bookings/calendar/slot-utils';
import { useCandidateWeeklySlotSelection } from '@/components/bookings/hooks/useCandidateWeeklySlotSelection';
import { useProfessionalWeeklySlotSelection } from '@/components/bookings/hooks/useProfessionalWeeklySlotSelection';

export type { SlotInterval } from '@/components/bookings/calendar/types';

const baseCellClasses = 'h-5 w-full border border-gray-100 transition-colors';

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

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={goToPreviousWeek}
                        disabled={!canGoPrev}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40"
                    >
                        Previous week
                    </button>
                    <span className="text-sm text-gray-700 min-w-[180px] text-center">
                        {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
                    </span>
                    <button
                        type="button"
                        onClick={goToNextWeek}
                        disabled={!canGoNext}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40"
                    >
                        Next week
                    </button>
                </div>
            </div>

            <div className="max-h-[620px] overflow-auto border border-gray-200 rounded-lg bg-white">
                <table className="w-full border-collapse table-fixed select-none">
                    <thead className="sticky top-0 z-10 bg-white">
                        <tr>
                            <th className="w-20 border-b border-gray-200 bg-white sticky left-0 z-20" />
                            {Array.from({ length: 7 }).map((_, dayOffset) => {
                                const day = addDays(weekStart, dayOffset);
                                return (
                                    <th
                                        key={day.toISOString()}
                                        className="border-b border-gray-200 py-2 text-xs font-semibold text-gray-700"
                                    >
                                        {format(day, 'EEE MMM d')}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: SLOTS_PER_DAY }).map((_, row) => (
                            <tr key={row}>
                                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white pr-2 align-top text-right text-[11px] text-gray-500">
                                    {getSlotLabel(row)}
                                </td>
                                {Array.from({ length: 7 }).map((__, dayOffset) => {
                                    const slotStart = slotDateForCell(weekStart, dayOffset, row);
                                    const cell = getCellMeta(slotStart);

                                    return (
                                        <td key={`${dayOffset}-${row}`} className="p-0">
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
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

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
    onSelect: (slotStartIso: string) => void;
}

export function ProfessionalWeeklySlotPicker({ slots, selectedSlot, onSelect }: ProfessionalWeeklySlotPickerProps) {
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

    if (!hasSlots || !weekStart) {
        return (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                No overlapping slots found. Ask the candidate to share additional times.
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-gray-900">Choose from candidate-submitted times</h3>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={goToPreviousWeek}
                        disabled={!canGoPrev}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40"
                    >
                        Previous week
                    </button>
                    <span className="text-sm text-gray-700 min-w-[170px] text-center">
                        {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d')}
                    </span>
                    <button
                        type="button"
                        onClick={goToNextWeek}
                        disabled={!canGoNext}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded disabled:opacity-40"
                    >
                        Next week
                    </button>
                </div>
            </div>

            <div className="max-h-[620px] overflow-auto border border-gray-200 rounded-lg bg-white">
                <table className="w-full border-collapse table-fixed">
                    <thead className="sticky top-0 z-10 bg-white">
                        <tr>
                            <th className="w-20 border-b border-gray-200 bg-white sticky left-0 z-20" />
                            {Array.from({ length: 7 }).map((_, dayOffset) => {
                                const day = addDays(weekStart, dayOffset);
                                return (
                                    <th
                                        key={day.toISOString()}
                                        className="border-b border-gray-200 py-2 text-xs font-semibold text-gray-700"
                                    >
                                        {format(day, 'EEE MMM d')}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: SLOTS_PER_DAY }).map((_, row) => (
                            <tr key={row}>
                                <td className="sticky left-0 z-10 border-r border-gray-200 bg-white pr-2 align-top text-right text-[11px] text-gray-500">
                                    {getSlotLabel(row)}
                                </td>
                                {Array.from({ length: 7 }).map((__, dayOffset) => {
                                    const slotStart = slotDateForCell(weekStart, dayOffset, row);
                                    const cell = getCellMeta(slotStart);

                                    const cellClass = cell.isSelected
                                        ? 'bg-blue-500 text-white border-blue-600'
                                        : cell.isSelectable
                                            ? 'bg-green-100 hover:bg-green-200 border-green-200'
                                            : 'bg-gray-50 border-gray-100';

                                    return (
                                        <td key={`${dayOffset}-${row}`} className="p-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (cell.isSelectable) onSelect(cell.key);
                                                }}
                                                className={`h-5 w-full border transition-colors ${cellClass} ${!cell.isSelectable ? 'cursor-default' : ''}`}
                                                title={format(slotStart, 'PPpp')}
                                            />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-600">
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-green-100 border border-green-200" />
                    Candidate available
                </span>
                <span className="inline-flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-blue-500 border border-blue-600" />
                    Selected slot
                </span>
            </div>
        </section>
    );
}
