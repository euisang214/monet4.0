import type { SlotCellState } from '@/components/bookings/calendar/types';

export const baseSlotCellClasses = 'calendar-slot-cell';

export const candidateSlotStateClasses: Record<SlotCellState, string> = {
    available: 'calendar-slot-state-candidate-available',
    blocked: 'calendar-slot-state-candidate-blocked',
    'google-busy': 'calendar-slot-state-candidate-google-busy',
    'google-busy-overridden': 'calendar-slot-state-candidate-google-busy-overridden',
    disabled: 'calendar-slot-state-candidate-disabled',
};

interface ProfessionalSlotClassArgs {
    isSelected: boolean;
    isSelectable: boolean;
    canSelect: boolean;
    readOnly: boolean;
}

export function getProfessionalSlotClass({
    isSelected,
    isSelectable,
    canSelect,
    readOnly,
}: ProfessionalSlotClassArgs): string {
    if (isSelected) {
        return 'calendar-slot-state-professional-selected';
    }

    if (isSelectable) {
        if (canSelect) {
            return 'calendar-slot-state-professional-selectable';
        }

        if (readOnly) {
            return 'calendar-slot-state-professional-readonly';
        }
    }

    return 'calendar-slot-state-professional-unavailable';
}
