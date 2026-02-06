'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addMinutes, format, startOfWeek } from 'date-fns';

const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;
const AVAILABILITY_WINDOW_DAYS = 30;
const WEEK_STARTS_ON = 0; // Sunday

export type SlotInterval = {
    start: string;
    end: string;
};

type SlotCellState = 'available' | 'blocked' | 'google-busy' | 'google-busy-overridden' | 'disabled';

function startOfSlot(date: Date): Date {
    const next = new Date(date);
    next.setSeconds(0, 0);
    const minutes = next.getMinutes();
    const rounded = minutes < 30 ? 0 : 30;
    next.setMinutes(rounded);
    return next;
}

function roundUpToNextSlot(date: Date): Date {
    const rounded = startOfSlot(date);
    if (rounded < date) {
        return addMinutes(rounded, SLOT_MINUTES);
    }
    return rounded;
}

function slotDateForCell(weekStart: Date, dayOffset: number, row: number): Date {
    const date = addDays(weekStart, dayOffset);
    date.setHours(0, 0, 0, 0);
    return addMinutes(date, row * SLOT_MINUTES);
}

function getSlotLabel(row: number): string {
    if (row % 2 !== 0) return '';
    const labelDate = new Date();
    labelDate.setHours(Math.floor(row / 2), 0, 0, 0);
    return format(labelDate, 'h a');
}

function normalizeInterval(interval: { start: string | Date; end: string | Date }) {
    return {
        start: interval.start instanceof Date ? interval.start : new Date(interval.start),
        end: interval.end instanceof Date ? interval.end : new Date(interval.end),
    };
}

function overlaps(start: Date, end: Date, interval: { start: Date; end: Date }): boolean {
    return interval.start < end && interval.end > start;
}

function mergeConsecutiveSlots(slotKeys: string[]): SlotInterval[] {
    if (slotKeys.length === 0) return [];

    const sorted = [...slotKeys]
        .map((key) => new Date(key))
        .sort((a, b) => a.getTime() - b.getTime());

    const merged: SlotInterval[] = [];
    let blockStart = sorted[0];
    let blockEnd = addMinutes(sorted[0], SLOT_MINUTES);

    for (let i = 1; i < sorted.length; i++) {
        const currentStart = sorted[i];
        const expectedNext = addMinutes(blockEnd, 0);
        if (currentStart.getTime() === expectedNext.getTime()) {
            blockEnd = addMinutes(currentStart, SLOT_MINUTES);
            continue;
        }

        merged.push({
            start: blockStart.toISOString(),
            end: blockEnd.toISOString(),
        });
        blockStart = currentStart;
        blockEnd = addMinutes(currentStart, SLOT_MINUTES);
    }

    merged.push({
        start: blockStart.toISOString(),
        end: blockEnd.toISOString(),
    });

    return merged;
}

interface CandidateWeeklySlotPickerProps {
    googleBusyIntervals: SlotInterval[];
    onChange: (payload: { availabilitySlots: SlotInterval[]; selectedCount: number }) => void;
}

export function CandidateWeeklySlotPicker({ googleBusyIntervals, onChange }: CandidateWeeklySlotPickerProps) {
    const now = useMemo(() => new Date(), []);
    const minSelectable = useMemo(() => roundUpToNextSlot(now), [now]);
    const maxSelectable = useMemo(() => addDays(minSelectable, AVAILABILITY_WINDOW_DAYS), [minSelectable]);
    const minWeekStart = useMemo(() => startOfWeek(minSelectable, { weekStartsOn: WEEK_STARTS_ON }), [minSelectable]);
    const maxWeekStart = useMemo(() => startOfWeek(maxSelectable, { weekStartsOn: WEEK_STARTS_ON }), [maxSelectable]);

    const [weekStart, setWeekStart] = useState<Date>(minWeekStart);
    const [selectedSlotKeys, setSelectedSlotKeys] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [dragSelectMode, setDragSelectMode] = useState<boolean | null>(null);

    const selectedSet = useMemo(() => new Set(selectedSlotKeys), [selectedSlotKeys]);
    const normalizedGoogleBusy = useMemo(
        () => googleBusyIntervals.map((interval) => normalizeInterval(interval)),
        [googleBusyIntervals]
    );

    const availabilitySlots = useMemo(
        () => mergeConsecutiveSlots(selectedSlotKeys),
        [selectedSlotKeys]
    );

    useEffect(() => {
        onChange({ availabilitySlots, selectedCount: selectedSlotKeys.length });
    }, [availabilitySlots, onChange, selectedSlotKeys.length]);

    useEffect(() => {
        const handlePointerUp = () => {
            setIsDragging(false);
            setDragSelectMode(null);
        };

        window.addEventListener('pointerup', handlePointerUp);
        return () => window.removeEventListener('pointerup', handlePointerUp);
    }, []);

    const isWithinSelectableWindow = useCallback(
        (slotStart: Date) => slotStart >= minSelectable && slotStart < maxSelectable,
        [maxSelectable, minSelectable]
    );

    const isGoogleBusy = useCallback(
        (slotStart: Date) => {
            const slotEnd = addMinutes(slotStart, SLOT_MINUTES);
            return normalizedGoogleBusy.some((busy) => overlaps(slotStart, slotEnd, busy));
        },
        [normalizedGoogleBusy]
    );

    const setSlotSelection = useCallback(
        (slotStart: Date, shouldSelect?: boolean) => {
            if (!isWithinSelectableWindow(slotStart)) return;

            const key = slotStart.toISOString();

            setSelectedSlotKeys((previous) => {
                const next = new Set(previous);

                if (shouldSelect === undefined) {
                    if (next.has(key)) {
                        next.delete(key);
                    } else {
                        next.add(key);
                    }
                } else {
                    if (shouldSelect) {
                        next.add(key);
                    } else {
                        next.delete(key);
                    }
                }

                return Array.from(next);
            });
        },
        [isWithinSelectableWindow]
    );

    const canGoPrev = weekStart.getTime() > minWeekStart.getTime();
    const canGoNext = weekStart.getTime() < maxWeekStart.getTime();

    return (
        <section className="space-y-4">
            <header className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">Select your availability (30-minute slots)</h3>
                    <div className="text-sm text-gray-600">{selectedSlotKeys.length} slots selected</div>
                </div>
                <p className="text-sm text-gray-600">
                    Click or drag any 30-minute cell to toggle availability. You can override Google Calendar busy blocks.
                </p>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => setSelectedSlotKeys([])}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
                >
                    Clear all
                </button>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setWeekStart((current) => addDays(current, -7))}
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
                        onClick={() => setWeekStart((current) => addDays(current, 7))}
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
                                    const key = slotStart.toISOString();
                                    const inWindow = isWithinSelectableWindow(slotStart);
                                    const busy = isGoogleBusy(slotStart);
                                    const selected = selectedSet.has(key);
                                    const canInteract = inWindow;

                                    let state: SlotCellState = 'disabled';
                                    if (inWindow && busy && selected) state = 'google-busy-overridden';
                                    else if (inWindow && busy) state = 'google-busy';
                                    else if (inWindow && selected) state = 'available';
                                    else if (inWindow) state = 'blocked';

                                    const baseCellClasses = 'h-5 w-full border border-gray-100 transition-colors';
                                    const stateClasses: Record<SlotCellState, string> = {
                                        available: 'bg-green-300 hover:bg-green-400',
                                        blocked: 'bg-gray-50 hover:bg-gray-100',
                                        'google-busy': 'bg-red-100 text-red-600 hover:bg-red-200',
                                        'google-busy-overridden': 'bg-orange-300 hover:bg-orange-400',
                                        disabled: 'bg-gray-100 cursor-not-allowed opacity-70',
                                    };

                                    return (
                                        <td key={`${dayOffset}-${row}`} className="p-0">
                                            <button
                                                type="button"
                                                onPointerDown={(event) => {
                                                    if (!canInteract) return;
                                                    event.preventDefault();
                                                    const shouldSelect = !selected;
                                                    setIsDragging(true);
                                                    setDragSelectMode(shouldSelect);
                                                    setSlotSelection(slotStart, shouldSelect);
                                                }}
                                                onPointerEnter={() => {
                                                    if (!isDragging || dragSelectMode === null) return;
                                                    if (!canInteract) return;
                                                    setSlotSelection(slotStart, dragSelectMode);
                                                }}
                                                className={`${baseCellClasses} ${stateClasses[state]}`}
                                                disabled={!canInteract}
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
    slots: Array<{ start: string | Date; end: string | Date }>;
    selectedSlot: string | null;
    onSelect: (slotStartIso: string) => void;
}

export function ProfessionalWeeklySlotPicker({ slots, selectedSlot, onSelect }: ProfessionalWeeklySlotPickerProps) {
    const normalizedSlots = useMemo(
        () =>
            slots
                .map((slot) => normalizeInterval(slot))
                .sort((a, b) => a.start.getTime() - b.start.getTime()),
        [slots]
    );

    const availableSlotKeys = useMemo(
        () => new Set(normalizedSlots.map((slot) => slot.start.toISOString())),
        [normalizedSlots]
    );

    const minWeekStart = useMemo(() => {
        if (normalizedSlots.length === 0) return null;
        return startOfWeek(normalizedSlots[0].start, { weekStartsOn: WEEK_STARTS_ON });
    }, [normalizedSlots]);

    const maxWeekStart = useMemo(() => {
        if (normalizedSlots.length === 0) return null;
        return startOfWeek(normalizedSlots[normalizedSlots.length - 1].start, { weekStartsOn: WEEK_STARTS_ON });
    }, [normalizedSlots]);

    const [weekStart, setWeekStart] = useState<Date | null>(minWeekStart);

    if (!weekStart || !minWeekStart || !maxWeekStart) {
        return (
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                No overlapping slots found. Ask the candidate to share additional times.
            </div>
        );
    }

    const canGoPrev = weekStart.getTime() > minWeekStart.getTime();
    const canGoNext = weekStart.getTime() < maxWeekStart.getTime();

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-medium text-gray-900">Choose from candidate-submitted times</h3>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setWeekStart((current) => (current ? addDays(current, -7) : current))}
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
                        onClick={() => setWeekStart((current) => (current ? addDays(current, 7) : current))}
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
                                    const key = slotStart.toISOString();
                                    const isSelectable = availableSlotKeys.has(key);
                                    const isSelected = selectedSlot === key;

                                    const cellClass = isSelected
                                        ? 'bg-blue-500 text-white border-blue-600'
                                        : isSelectable
                                            ? 'bg-green-100 hover:bg-green-200 border-green-200'
                                            : 'bg-gray-50 border-gray-100';

                                    return (
                                        <td key={`${dayOffset}-${row}`} className="p-0">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isSelectable) onSelect(key);
                                                }}
                                                className={`h-5 w-full border transition-colors ${cellClass} ${!isSelectable ? 'cursor-default' : ''}`}
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
