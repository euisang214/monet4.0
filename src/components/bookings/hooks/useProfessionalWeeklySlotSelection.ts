'use client';

import { useCallback, useMemo, useState } from 'react';
import { addMinutes } from 'date-fns';
import {
    SLOT_MINUTES,
    WEEK_STARTS_ON,
    addDaysInTimeZone,
    normalizeInterval,
    startOfSlot,
    startOfWeekInTimeZone,
} from '@/components/bookings/calendar/slot-utils';
import type { SlotInput } from '@/components/bookings/calendar/types';

type ProfessionalCellMeta = {
    key: string;
    isSelectable: boolean;
    isSelected: boolean;
};

interface UseProfessionalWeeklySlotSelectionArgs {
    slots: SlotInput[];
    selectedSlot: string | null;
    calendarTimezone: string;
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

export function useProfessionalWeeklySlotSelection({
    slots,
    selectedSlot,
    calendarTimezone,
}: UseProfessionalWeeklySlotSelectionArgs) {
    const normalizedSlots = useMemo(
        () => slots.map((slot) => normalizeInterval(slot)).sort((a, b) => a.start.getTime() - b.start.getTime()),
        [slots]
    );
    const selectableSlotKeys = useMemo(() => {
        const keys = new Set<string>();

        for (const slot of normalizedSlots) {
            let cursor = startOfSlot(slot.start);
            while (cursor < slot.end) {
                keys.add(cursor.toISOString());
                cursor = addMinutes(cursor, SLOT_MINUTES);
            }
        }

        return keys;
    }, [normalizedSlots]);

    const bounds = useMemo(
        () => getProfessionalWeekBounds(slots, calendarTimezone),
        [calendarTimezone, slots]
    );
    const minWeekStart = bounds?.minWeekStart || null;
    const maxWeekStart = bounds?.maxWeekStart || null;

    const [weekStart, setWeekStart] = useState<Date | null>(minWeekStart);

    const hasSlots = !!(weekStart && minWeekStart && maxWeekStart);
    const canGoPrev = !!(hasSlots && weekStart.getTime() > minWeekStart.getTime());
    const canGoNext = !!(hasSlots && weekStart.getTime() < maxWeekStart.getTime());

    const goToPreviousWeek = useCallback(() => {
        setWeekStart((current) => (current ? addDaysInTimeZone(current, -7, calendarTimezone) : current));
    }, [calendarTimezone]);

    const goToNextWeek = useCallback(() => {
        setWeekStart((current) => (current ? addDaysInTimeZone(current, 7, calendarTimezone) : current));
    }, [calendarTimezone]);

    const getCellMeta = useCallback(
        (slotStart: Date): ProfessionalCellMeta => {
            const key = slotStart.toISOString();
            return {
                key,
                isSelectable: selectableSlotKeys.has(key),
                isSelected: selectedSlot === key,
            };
        },
        [selectableSlotKeys, selectedSlot]
    );

    return {
        weekStart,
        hasSlots,
        canGoPrev,
        canGoNext,
        goToPreviousWeek,
        goToNextWeek,
        getCellMeta,
    };
}
