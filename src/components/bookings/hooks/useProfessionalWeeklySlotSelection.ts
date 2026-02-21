'use client';

import type { SlotInput } from '@/components/bookings/calendar/types';
import {
    useUnifiedWeeklyCalendarState,
    getProfessionalWeekBounds,
    type SingleSelectCellMeta,
    type UnifiedSingleSelectState,
} from '@/components/bookings/hooks/useUnifiedWeeklyCalendarState';

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

function mapSingleCellMeta(cell: SingleSelectCellMeta): ProfessionalCellMeta {
    return {
        key: cell.key,
        isSelectable: cell.isSelectable,
        isSelected: cell.isSelected,
    };
}

export { getProfessionalWeekBounds };

export function useProfessionalWeeklySlotSelection({
    slots,
    selectedSlot,
    calendarTimezone,
}: UseProfessionalWeeklySlotSelectionArgs) {
    const state = useUnifiedWeeklyCalendarState({
        mode: 'single-select',
        slots,
        selectedSlot,
        calendarTimezone,
    }) as UnifiedSingleSelectState;

    return {
        weekStart: state.weekStart,
        hasSlots: state.hasSlots,
        canGoPrev: state.canGoPrev,
        canGoNext: state.canGoNext,
        goToPreviousWeek: state.goToPreviousWeek,
        goToNextWeek: state.goToNextWeek,
        getCellMeta: (slotStart: Date): ProfessionalCellMeta => mapSingleCellMeta(state.getCellMeta(slotStart)),
    };
}

