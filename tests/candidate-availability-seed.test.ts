import { beforeEach, describe, expect, it, vi } from 'vitest';

const userFindUniqueMock = vi.hoisted(() => vi.fn());
const getUserAvailabilityMock = vi.hoisted(() => vi.fn());
const getCandidateBusyTimesMock = vi.hoisted(() => vi.fn());
const setAvailabilityMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/core/db', () => ({
    prisma: {
        user: {
            findUnique: userFindUniqueMock,
        },
    },
}));

vi.mock('@/lib/domain/availability/service', () => ({
    AvailabilityService: {
        getCandidateBusyTimes: getCandidateBusyTimesMock,
        setAvailability: setAvailabilityMock,
        getUserAvailability: getUserAvailabilityMock,
    },
}));

import { CandidateAvailability } from '@/lib/role/candidate/availability';

describe('CandidateAvailability.getSavedAvailabilitySeed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns only future non-busy slots sorted and mapped to ISO strings', async () => {
        const nowMs = Date.now();
        const slotAStart = new Date(nowMs + 2 * 60 * 60 * 1000);
        const slotAEnd = new Date(nowMs + 2.5 * 60 * 60 * 1000);
        const slotBStart = new Date(nowMs + 4 * 60 * 60 * 1000);
        const slotBEnd = new Date(nowMs + 4.5 * 60 * 60 * 1000);
        const pastStart = new Date(nowMs - 2 * 60 * 60 * 1000);
        const pastEnd = new Date(nowMs - 1 * 60 * 60 * 1000);

        userFindUniqueMock.mockResolvedValue({ timezone: 'America/Chicago' });
        getUserAvailabilityMock.mockResolvedValue([
            { busy: false, start: slotBStart, end: slotBEnd },
            { busy: true, start: slotAStart, end: slotAEnd },
            { busy: false, start: pastStart, end: pastEnd },
            { busy: false, start: slotAStart, end: slotAEnd },
        ]);

        const result = await CandidateAvailability.getSavedAvailabilitySeed('cand-1');

        expect(userFindUniqueMock).toHaveBeenCalledWith({
            where: { id: 'cand-1' },
            select: { timezone: true },
        });
        expect(getUserAvailabilityMock).toHaveBeenCalledWith('cand-1');
        expect(result).toEqual({
            candidateTimezone: 'America/Chicago',
            initialAvailabilitySlots: [
                { start: slotAStart.toISOString(), end: slotAEnd.toISOString() },
                { start: slotBStart.toISOString(), end: slotBEnd.toISOString() },
            ],
        });
    });

    it('falls back to UTC when user timezone cannot be resolved', async () => {
        userFindUniqueMock.mockResolvedValue(null);
        getUserAvailabilityMock.mockResolvedValue([]);

        const result = await CandidateAvailability.getSavedAvailabilitySeed('cand-2');

        expect(result).toEqual({
            candidateTimezone: 'UTC',
            initialAvailabilitySlots: [],
        });
    });
});
