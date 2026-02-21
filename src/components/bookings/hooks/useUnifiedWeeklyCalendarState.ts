'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addMinutes, startOfWeek } from 'date-fns';
import type { SlotCellState, SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import {
    AVAILABILITY_WINDOW_DAYS,
    SLOT_MINUTES,
    WEEK_STARTS_ON,
    addDaysInTimeZone,
    mergeConsecutiveSlots,
    normalizeInterval,
    roundUpToNextSlot,
    startOfSlot,
    startOfWeekInTimeZone,
} from '@/components/bookings/calendar/slot-utils';

export type SingleSelectCellMeta = {
    key: string;
    isSelectable: boolean;
    isSelected: boolean;
};

export type MultiToggleCellMeta = {
    key: string;
    canInteract: boolean;
    state: SlotCellState;
};

interface MultiToggleArgs {
    mode: 'multi-toggle';
    googleBusyIntervals: SlotInterval[];
    initialSelectedSlots?: SlotInterval[];
    onSelectionChange?: (payload: { slots: SlotInterval[]; selectedCount: number }) => void;
}

interface SingleSelectArgs {
    mode: 'single-select';
    slots: SlotInput[];
    selectedSlot: string | null;
    calendarTimezone: string;
}

export type UnifiedWeeklyCalendarArgs = MultiToggleArgs | SingleSelectArgs;

export type UnifiedMultiToggleState = {
    mode: 'multi-toggle';
    weekStart: Date;
    canGoPrev: boolean;
    canGoNext: boolean;
    selectedCount: number;
    getCellMeta: (slotStart: Date) => MultiToggleCellMeta;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    clearSelection: () => void;
    handleSlotPointerDown: (slotStart: Date) => void;
    handleSlotPointerEnter: (slotStart: Date) => void;
};

export type UnifiedSingleSelectState = {
    mode: 'single-select';
    weekStart: Date | null;
    hasSlots: boolean;
    canGoPrev: boolean;
    canGoNext: boolean;
    getCellMeta: (slotStart: Date) => SingleSelectCellMeta;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
};

export type UnifiedWeeklyCalendarState = UnifiedMultiToggleState | UnifiedSingleSelectState;

function toCellState(inWindow: boolean, busy: boolean, selected: boolean): SlotCellState {
    if (!inWindow) return 'disabled';
    if (busy && selected) return 'google-busy-overridden';
    if (busy) return 'google-busy';
    if (selected) return 'available';
    return 'blocked';
}

interface ExpandIntervalsToSlotKeysOptions {
    minSelectable?: Date;
    maxSelectable?: Date;
}

export function expandIntervalsToSlotKeys(
    intervals: SlotInterval[],
    options: ExpandIntervalsToSlotKeysOptions = {}
): string[] {
    const keys = new Set<string>();
    const { minSelectable, maxSelectable } = options;

    for (const interval of intervals) {
        const normalized = normalizeInterval(interval);
        if (!(normalized.end > normalized.start)) {
            continue;
        }

        let cursor = startOfSlot(normalized.start);
        while (cursor < normalized.end) {
            if (
                (!minSelectable || cursor >= minSelectable) &&
                (!maxSelectable || cursor < maxSelectable)
            ) {
                keys.add(cursor.toISOString());
            }

            cursor = addMinutes(cursor, SLOT_MINUTES);
        }
    }

    return Array.from(keys).sort();
}

export function getProfessionalWeekBounds(
    slots: SlotInput[],
    calendarTimezone: string
): { minWeekStart: Date; maxWeekStart: Date } | null {
    const normalizedSlots = slots
        .map((slot) => normalizeInterval(slot))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (normalizedSlots.length === 0) return null;

    return {
        minWeekStart: startOfWeekInTimeZone(normalizedSlots[0].start, calendarTimezone, WEEK_STARTS_ON),
        maxWeekStart: startOfWeekInTimeZone(
            normalizedSlots[normalizedSlots.length - 1].start,
            calendarTimezone,
            WEEK_STARTS_ON
        ),
    };
}

export function useUnifiedWeeklyCalendarState(
    args: UnifiedWeeklyCalendarArgs
): UnifiedWeeklyCalendarState {
    const mode = args.mode;

    const now = useMemo(() => new Date(), []);
    const minSelectable = useMemo(() => roundUpToNextSlot(now), [now]);
    const maxSelectable = useMemo(() => addDays(minSelectable, AVAILABILITY_WINDOW_DAYS), [minSelectable]);
    const minWeekStartForMulti = useMemo(
        () => startOfWeek(minSelectable, { weekStartsOn: WEEK_STARTS_ON }),
        [minSelectable]
    );
    const maxWeekStartForMulti = useMemo(
        () => startOfWeek(maxSelectable, { weekStartsOn: WEEK_STARTS_ON }),
        [maxSelectable]
    );

    const multiInitialSlots = useMemo(
        () => (mode === 'multi-toggle' ? (args.initialSelectedSlots || []) : []),
        [args, mode]
    );
    const initialSelectionKeys = useMemo(
        () => expandIntervalsToSlotKeys(multiInitialSlots, { minSelectable, maxSelectable }),
        [maxSelectable, minSelectable, multiInitialSlots]
    );
    const [multiWeekStart, setMultiWeekStart] = useState<Date>(minWeekStartForMulti);
    const [selectedSlotKeys, setSelectedSlotKeys] = useState<string[]>(initialSelectionKeys);
    const [isDragging, setIsDragging] = useState(false);
    const [dragSelectMode, setDragSelectMode] = useState<boolean | null>(null);

    const selectedSet = useMemo(() => new Set(selectedSlotKeys), [selectedSlotKeys]);
    const normalizedGoogleBusy = useMemo(
        () => (mode === 'multi-toggle' ? args.googleBusyIntervals : []).map((interval) => normalizeInterval(interval)),
        [args, mode]
    );
    const busySlotKeys = useMemo(() => {
        const keys = new Set<string>();

        for (const busy of normalizedGoogleBusy) {
            let cursor = startOfSlot(busy.start);
            while (cursor < busy.end) {
                keys.add(cursor.toISOString());
                cursor = addMinutes(cursor, SLOT_MINUTES);
            }
        }

        return keys;
    }, [normalizedGoogleBusy]);

    const availabilitySlots = useMemo(() => mergeConsecutiveSlots(selectedSlotKeys), [selectedSlotKeys]);

    useEffect(() => {
        if (mode !== 'multi-toggle') return;
        args.onSelectionChange?.({ slots: availabilitySlots, selectedCount: selectedSlotKeys.length });
    }, [args, availabilitySlots, mode, selectedSlotKeys.length]);

    useEffect(() => {
        if (mode !== 'multi-toggle') return;

        const handlePointerUp = () => {
            setIsDragging(false);
            setDragSelectMode(null);
        };

        window.addEventListener('pointerup', handlePointerUp);
        return () => window.removeEventListener('pointerup', handlePointerUp);
    }, [mode]);

    const isWithinSelectableWindow = useCallback(
        (slotStart: Date) => slotStart >= minSelectable && slotStart < maxSelectable,
        [maxSelectable, minSelectable]
    );

    const isGoogleBusy = useCallback(
        (slotStart: Date) => busySlotKeys.has(slotStart.toISOString()),
        [busySlotKeys]
    );

    const setSlotSelection = useCallback(
        (slotStart: Date, shouldSelect?: boolean) => {
            if (!isWithinSelectableWindow(slotStart)) return;

            const key = slotStart.toISOString();
            setSelectedSlotKeys((previous) => {
                const next = new Set(previous);
                let didChange = false;

                if (shouldSelect === undefined) {
                    if (next.has(key)) {
                        next.delete(key);
                        didChange = true;
                    } else {
                        next.add(key);
                        didChange = true;
                    }
                } else if (shouldSelect) {
                    if (!next.has(key)) {
                        next.add(key);
                        didChange = true;
                    }
                } else {
                    if (next.has(key)) {
                        next.delete(key);
                        didChange = true;
                    }
                }

                if (!didChange) return previous;
                return Array.from(next);
            });
        },
        [isWithinSelectableWindow]
    );

    const handleSlotPointerDown = useCallback(
        (slotStart: Date) => {
            if (!isWithinSelectableWindow(slotStart)) return;

            const key = slotStart.toISOString();
            const shouldSelect = !selectedSet.has(key);
            setIsDragging(true);
            setDragSelectMode(shouldSelect);
            setSlotSelection(slotStart, shouldSelect);
        },
        [isWithinSelectableWindow, selectedSet, setSlotSelection]
    );

    const handleSlotPointerEnter = useCallback(
        (slotStart: Date) => {
            if (!isDragging || dragSelectMode === null) return;
            if (!isWithinSelectableWindow(slotStart)) return;
            setSlotSelection(slotStart, dragSelectMode);
        },
        [dragSelectMode, isDragging, isWithinSelectableWindow, setSlotSelection]
    );

    const getMultiCellMeta = useCallback(
        (slotStart: Date): MultiToggleCellMeta => {
            const key = slotStart.toISOString();
            const inWindow = isWithinSelectableWindow(slotStart);
            const busy = inWindow && isGoogleBusy(slotStart);
            const selected = selectedSet.has(key);

            return {
                key,
                canInteract: inWindow,
                state: toCellState(inWindow, busy, selected),
            };
        },
        [isGoogleBusy, isWithinSelectableWindow, selectedSet]
    );

    const multiCanGoPrev = multiWeekStart.getTime() > minWeekStartForMulti.getTime();
    const multiCanGoNext = multiWeekStart.getTime() < maxWeekStartForMulti.getTime();

    const goToPreviousWeekForMulti = useCallback(() => {
        setMultiWeekStart((current) => addDays(current, -7));
    }, []);

    const goToNextWeekForMulti = useCallback(() => {
        setMultiWeekStart((current) => addDays(current, 7));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedSlotKeys([]);
    }, []);

    const singleSlots = useMemo(
        () => (mode === 'single-select' ? args.slots : []),
        [args, mode]
    );
    const calendarTimezone = mode === 'single-select' ? args.calendarTimezone : 'UTC';
    const selectedSlot = mode === 'single-select' ? args.selectedSlot : null;
    const normalizedSlotsForSingle = useMemo(
        () => singleSlots.map((slot) => normalizeInterval(slot)).sort((a, b) => a.start.getTime() - b.start.getTime()),
        [singleSlots]
    );
    const selectableSlotKeys = useMemo(() => {
        const keys = new Set<string>();

        for (const slot of normalizedSlotsForSingle) {
            let cursor = startOfSlot(slot.start);
            while (cursor < slot.end) {
                keys.add(cursor.toISOString());
                cursor = addMinutes(cursor, SLOT_MINUTES);
            }
        }

        return keys;
    }, [normalizedSlotsForSingle]);
    const singleBounds = useMemo(
        () => getProfessionalWeekBounds(singleSlots, calendarTimezone),
        [calendarTimezone, singleSlots]
    );
    const minWeekStartForSingle = singleBounds?.minWeekStart || null;
    const maxWeekStartForSingle = singleBounds?.maxWeekStart || null;
    const [singleWeekStart, setSingleWeekStart] = useState<Date | null>(minWeekStartForSingle);
    const hasSlots = !!(singleWeekStart && minWeekStartForSingle && maxWeekStartForSingle);
    const singleCanGoPrev = !!(hasSlots && singleWeekStart.getTime() > minWeekStartForSingle.getTime());
    const singleCanGoNext = !!(hasSlots && singleWeekStart.getTime() < maxWeekStartForSingle.getTime());

    const goToPreviousWeekForSingle = useCallback(() => {
        setSingleWeekStart((current) => (current ? addDaysInTimeZone(current, -7, calendarTimezone) : current));
    }, [calendarTimezone]);

    const goToNextWeekForSingle = useCallback(() => {
        setSingleWeekStart((current) => (current ? addDaysInTimeZone(current, 7, calendarTimezone) : current));
    }, [calendarTimezone]);

    const getSingleCellMeta = useCallback(
        (slotStart: Date): SingleSelectCellMeta => {
            const key = slotStart.toISOString();
            return {
                key,
                isSelectable: selectableSlotKeys.has(key),
                isSelected: selectedSlot === key,
            };
        },
        [selectableSlotKeys, selectedSlot]
    );

    if (mode === 'multi-toggle') {
        return {
            mode: 'multi-toggle',
            weekStart: multiWeekStart,
            canGoPrev: multiCanGoPrev,
            canGoNext: multiCanGoNext,
            selectedCount: selectedSlotKeys.length,
            getCellMeta: getMultiCellMeta,
            goToPreviousWeek: goToPreviousWeekForMulti,
            goToNextWeek: goToNextWeekForMulti,
            clearSelection,
            handleSlotPointerDown,
            handleSlotPointerEnter,
        };
    }

    return {
        mode: 'single-select',
        weekStart: singleWeekStart,
        hasSlots,
        canGoPrev: singleCanGoPrev,
        canGoNext: singleCanGoNext,
        getCellMeta: getSingleCellMeta,
        goToPreviousWeek: goToPreviousWeekForSingle,
        goToNextWeek: goToNextWeekForSingle,
    };
}
