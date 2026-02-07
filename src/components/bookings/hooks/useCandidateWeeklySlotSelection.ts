'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, addMinutes, startOfWeek } from 'date-fns';
import type { SlotCellState, SlotInterval } from '@/components/bookings/calendar/types';
import {
    AVAILABILITY_WINDOW_DAYS,
    SLOT_MINUTES,
    WEEK_STARTS_ON,
    mergeConsecutiveSlots,
    normalizeInterval,
    overlaps,
    roundUpToNextSlot,
} from '@/components/bookings/calendar/slot-utils';

type SelectionChangePayload = {
    availabilitySlots: SlotInterval[];
    selectedCount: number;
};

type CandidateCellMeta = {
    key: string;
    canInteract: boolean;
    state: SlotCellState;
};

interface UseCandidateWeeklySlotSelectionArgs {
    googleBusyIntervals: SlotInterval[];
    onChange?: (payload: SelectionChangePayload) => void;
}

function toCellState(inWindow: boolean, busy: boolean, selected: boolean): SlotCellState {
    if (!inWindow) return 'disabled';
    if (busy && selected) return 'google-busy-overridden';
    if (busy) return 'google-busy';
    if (selected) return 'available';
    return 'blocked';
}

export function useCandidateWeeklySlotSelection({
    googleBusyIntervals,
    onChange,
}: UseCandidateWeeklySlotSelectionArgs) {
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

    const availabilitySlots = useMemo(() => mergeConsecutiveSlots(selectedSlotKeys), [selectedSlotKeys]);

    useEffect(() => {
        onChange?.({ availabilitySlots, selectedCount: selectedSlotKeys.length });
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
                } else if (shouldSelect) {
                    next.add(key);
                } else {
                    next.delete(key);
                }

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

    const getCellMeta = useCallback(
        (slotStart: Date): CandidateCellMeta => {
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

    const canGoPrev = weekStart.getTime() > minWeekStart.getTime();
    const canGoNext = weekStart.getTime() < maxWeekStart.getTime();

    const goToPreviousWeek = useCallback(() => {
        setWeekStart((current) => addDays(current, -7));
    }, []);

    const goToNextWeek = useCallback(() => {
        setWeekStart((current) => addDays(current, 7));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedSlotKeys([]);
    }, []);

    return {
        weekStart,
        canGoPrev,
        canGoNext,
        selectedCount: selectedSlotKeys.length,
        getCellMeta,
        goToPreviousWeek,
        goToNextWeek,
        clearSelection,
        handleSlotPointerDown,
        handleSlotPointerEnter,
    };
}
