'use client';

import type { SlotInput, SlotInterval } from '@/components/bookings/calendar/types';
import {
    UnifiedWeeklyCalendar,
    type LegendItem,
} from '@/components/bookings/UnifiedWeeklyCalendar';

export type { SlotInterval } from '@/components/bookings/calendar/types';

interface CandidateWeeklySlotPickerProps {
    googleBusyIntervals: SlotInterval[];
    onChange: (payload: { availabilitySlots: SlotInterval[]; selectedCount: number }) => void;
    initialSelectedSlots?: SlotInterval[];
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    heading?: string;
    description?: string;
    showClearAll?: boolean;
    legends?: LegendItem[];
}

export function CandidateWeeklySlotPicker({
    googleBusyIntervals,
    onChange,
    initialSelectedSlots,
    calendarTimezone,
    professionalTimezone,
    heading = 'Select Your Availability (30-minute slots)',
    description = 'Click or drag any 30-minute cell to toggle availability. You can override Google Calendar busy blocks.',
    showClearAll = true,
    legends,
}: CandidateWeeklySlotPickerProps) {
    return (
        <UnifiedWeeklyCalendar
            mode="multi-toggle"
            calendarTimezone={calendarTimezone}
            counterpartTimezone={professionalTimezone}
            googleBusyIntervals={googleBusyIntervals}
            initialSelectedSlots={initialSelectedSlots}
            onSelectionChange={({ slots, selectedCount }) => onChange({
                availabilitySlots: slots,
                selectedCount,
            })}
            header={{ title: heading, description }}
            showClearAll={showClearAll}
            legends={legends}
        />
    );
}

interface ProfessionalWeeklySlotPickerProps {
    slots: SlotInput[];
    selectedSlot: string | null;
    onSelect?: (slotStartIso: string) => void;
    readOnly?: boolean;
    calendarTimezone?: string;
    professionalTimezone?: string | null;
    heading?: string;
    legends?: LegendItem[];
}

export function ProfessionalWeeklySlotPicker({
    slots,
    selectedSlot,
    onSelect,
    readOnly = false,
    calendarTimezone,
    professionalTimezone,
    heading,
    legends,
}: ProfessionalWeeklySlotPickerProps) {
    const resolvedHeading = heading || (readOnly
        ? 'Your availability calendar'
        : 'Choose from candidate-submitted times');

    return (
        <UnifiedWeeklyCalendar
            mode="single-select"
            calendarTimezone={calendarTimezone}
            counterpartTimezone={professionalTimezone}
            selectableSlots={slots}
            selectedSlot={selectedSlot}
            onSelect={onSelect}
            readOnly={readOnly}
            header={{ title: resolvedHeading }}
            legends={legends}
        />
    );
}

