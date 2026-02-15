import { describe, expect, it } from 'vitest';
import { baseSlotCellClasses, candidateSlotStateClasses, getProfessionalSlotClass } from '@/components/bookings/calendar/slot-styles';

describe('weekly slot calendar styles', () => {
    it('uses dedicated rectangular slot cell styling class', () => {
        expect(baseSlotCellClasses).toContain('calendar-slot-cell');
    });

    it('maps professional selectable state to white emphasized cells', () => {
        const className = getProfessionalSlotClass({
            isSelected: false,
            isSelectable: true,
            canSelect: true,
            readOnly: false,
        });

        expect(className).toContain('calendar-slot-state-professional-selectable');
    });

    it('maps professional selected state to solid blue block', () => {
        const className = getProfessionalSlotClass({
            isSelected: true,
            isSelectable: true,
            canSelect: true,
            readOnly: false,
        });

        expect(className).toContain('calendar-slot-state-professional-selected');
    });

    it('maps professional unavailable state to gray fill', () => {
        const className = getProfessionalSlotClass({
            isSelected: false,
            isSelectable: false,
            canSelect: false,
            readOnly: false,
        });

        expect(className).toContain('calendar-slot-state-professional-unavailable');
    });

    it('maps candidate chosen state to full filled block', () => {
        expect(candidateSlotStateClasses.available).toContain('calendar-slot-state-candidate-available');
    });
});
