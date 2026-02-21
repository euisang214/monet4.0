'use client';

import type { SlotCellState, SlotInterval } from '@/components/bookings/calendar/types';
import {
    useUnifiedWeeklyCalendarState,
    expandIntervalsToSlotKeys,
    type MultiToggleCellMeta,
    type UnifiedMultiToggleState,
} from '@/components/bookings/hooks/useUnifiedWeeklyCalendarState';

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
    initialSelectedSlots?: SlotInterval[];
    onChange?: (payload: SelectionChangePayload) => void;
}

function mapMultiCellMeta(cell: MultiToggleCellMeta): CandidateCellMeta {
    return {
        key: cell.key,
        canInteract: cell.canInteract,
        state: cell.state,
    };
}

export { expandIntervalsToSlotKeys };

export function useCandidateWeeklySlotSelection({
    googleBusyIntervals,
    initialSelectedSlots = [],
    onChange,
}: UseCandidateWeeklySlotSelectionArgs) {
    const state = useUnifiedWeeklyCalendarState({
        mode: 'multi-toggle',
        googleBusyIntervals,
        initialSelectedSlots,
        onSelectionChange: onChange
            ? ({ slots, selectedCount }) => onChange({
                availabilitySlots: slots,
                selectedCount,
            })
            : undefined,
    }) as UnifiedMultiToggleState;

    return {
        weekStart: state.weekStart,
        canGoPrev: state.canGoPrev,
        canGoNext: state.canGoNext,
        selectedCount: state.selectedCount,
        getCellMeta: (slotStart: Date): CandidateCellMeta => mapMultiCellMeta(state.getCellMeta(slotStart)),
        goToPreviousWeek: state.goToPreviousWeek,
        goToNextWeek: state.goToNextWeek,
        clearSelection: state.clearSelection,
        handleSlotPointerDown: state.handleSlotPointerDown,
        handleSlotPointerEnter: state.handleSlotPointerEnter,
    };
}

