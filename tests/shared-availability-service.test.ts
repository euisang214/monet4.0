import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/core/db', () => {
    const mockPrisma = {
        user: {
            findUnique: vi.fn(),
        },
        availability: {
            deleteMany: vi.fn(),
            createMany: vi.fn(),
            findMany: vi.fn(),
        },
        $transaction: vi.fn(),
    };
    mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => Promise<unknown>) =>
        callback(mockPrisma)
    );

    return { prisma: mockPrisma };
});

vi.mock('@/lib/integrations/calendar/google', () => ({
    getGoogleBusyTimes: vi.fn(),
}));

import { prisma } from '@/lib/core/db';
import { AvailabilityService } from '@/lib/shared/availability';

type MockFn = ReturnType<typeof vi.fn>;

describe('AvailabilityService.replaceUserAvailability', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.user.findUnique as unknown as MockFn).mockResolvedValue({
            timezone: 'America/Chicago',
        });
        (prisma.availability.deleteMany as unknown as MockFn).mockResolvedValue({ count: 0 });
        (prisma.availability.createMany as unknown as MockFn).mockResolvedValue({ count: 0 });
    });

    it('persists availability rows using canonical user timezone instead of payload timezone', async () => {
        await AvailabilityService.replaceUserAvailability(
            'cand-1',
            [
                { start: '2026-02-21T17:00:00.000Z', end: '2026-02-21T18:00:00.000Z' },
                { start: '2026-02-21T18:00:00.000Z', end: '2026-02-21T19:00:00.000Z' },
            ],
            'America/New_York'
        );

        expect(prisma.availability.createMany).toHaveBeenCalledTimes(1);
        expect(prisma.availability.createMany).toHaveBeenCalledWith({
            data: [
                {
                    userId: 'cand-1',
                    start: new Date('2026-02-21T17:00:00.000Z'),
                    end: new Date('2026-02-21T18:00:00.000Z'),
                    busy: false,
                    timezone: 'America/Chicago',
                },
                {
                    userId: 'cand-1',
                    start: new Date('2026-02-21T18:00:00.000Z'),
                    end: new Date('2026-02-21T19:00:00.000Z'),
                    busy: false,
                    timezone: 'America/Chicago',
                },
            ],
        });
    });

    it('throws when the user record cannot be resolved', async () => {
        (prisma.user.findUnique as unknown as MockFn).mockResolvedValue(null);

        await expect(
            AvailabilityService.replaceUserAvailability(
                'missing-user',
                [{ start: '2026-02-21T17:00:00.000Z', end: '2026-02-21T18:00:00.000Z' }],
                'America/New_York'
            )
        ).rejects.toThrow('User not found');
    });
});
