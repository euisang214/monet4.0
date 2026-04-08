import { Prisma, RescheduleAwaitingParty, RescheduleProposalSource, Role } from '@prisma/client';
import type { SlotInterval } from '@/components/bookings/calendar/types';

export type RescheduleProposalSlot = {
    startAt: string;
    endAt: string;
};

export function roleToAwaitingParty(role: Role): RescheduleAwaitingParty {
    return role === Role.CANDIDATE
        ? RescheduleAwaitingParty.CANDIDATE
        : RescheduleAwaitingParty.PROFESSIONAL;
}

export function oppositeAwaitingParty(party: RescheduleAwaitingParty): RescheduleAwaitingParty {
    return party === RescheduleAwaitingParty.CANDIDATE
        ? RescheduleAwaitingParty.PROFESSIONAL
        : RescheduleAwaitingParty.CANDIDATE;
}

export function roleToProposalSource(role: Role): RescheduleProposalSource {
    return role === Role.CANDIDATE
        ? RescheduleProposalSource.CANDIDATE
        : RescheduleProposalSource.PROFESSIONAL;
}

export function serializeProposalSlots(
    slots: Array<{ start: Date; end: Date }>
): Prisma.InputJsonValue {
    return slots.map((slot) => ({
        startAt: slot.start.toISOString(),
        endAt: slot.end.toISOString(),
    }));
}

export function parseProposalSlots(value: Prisma.JsonValue | null | undefined): RescheduleProposalSlot[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return [];
        }

        const startAt = 'startAt' in entry ? entry.startAt : null;
        const endAt = 'endAt' in entry ? entry.endAt : null;

        if (typeof startAt !== 'string' || typeof endAt !== 'string') {
            return [];
        }

        return [{ startAt, endAt }];
    });
}

export function proposalSlotsToIntervals(slots: RescheduleProposalSlot[]): SlotInterval[] {
    return slots.map((slot) => ({
        start: slot.startAt,
        end: slot.endAt,
    }));
}

export function matchesProposalSlot(
    slots: RescheduleProposalSlot[],
    startAt: Date,
    endAt: Date
): boolean {
    const startIso = startAt.toISOString();
    const endIso = endAt.toISOString();

    return slots.some((slot) => slot.startAt === startIso && slot.endAt === endIso);
}
