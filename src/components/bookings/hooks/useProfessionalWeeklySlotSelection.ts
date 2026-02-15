'use client';

import { useCallback, useMemo, useState } from 'react';
import { addDays, addMinutes, startOfWeek } from 'date-fns';
import { SLOT_MINUTES, WEEK_STARTS_ON, normalizeInterval, startOfSlot } from '@/components/bookings/calendar/slot-utils';
import type { SlotInput } from '@/components/bookings/calendar/types';

type ProfessionalCellMeta = {
    key: string;
    isSelectable: boolean;
    isSelected: boolean;
};

interface UseProfessionalWeeklySlotSelectionArgs {
    slots: SlotInput[];
    selectedSlot: string | null;
}

export function useProfessionalWeeklySlotSelection({
    slots,
    selectedSlot,
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

    const minWeekStart = useMemo(() => {
        if (normalizedSlots.length === 0) return null;
        return startOfWeek(normalizedSlots[0].start, { weekStartsOn: WEEK_STARTS_ON });
    }, [normalizedSlots]);

    const maxWeekStart = useMemo(() => {
        if (normalizedSlots.length === 0) return null;
        return startOfWeek(normalizedSlots[normalizedSlots.length - 1].start, { weekStartsOn: WEEK_STARTS_ON });
    }, [normalizedSlots]);

    const [weekStart, setWeekStart] = useState<Date | null>(minWeekStart);

    const hasSlots = !!(weekStart && minWeekStart && maxWeekStart);
    const canGoPrev = !!(hasSlots && weekStart.getTime() > minWeekStart.getTime());
    const canGoNext = !!(hasSlots && weekStart.getTime() < maxWeekStart.getTime());

    const goToPreviousWeek = useCallback(() => {
        setWeekStart((current) => (current ? addDays(current, -7) : current));
    }, []);

    const goToNextWeek = useCallback(() => {
        setWeekStart((current) => (current ? addDays(current, 7) : current));
    }, []);

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
