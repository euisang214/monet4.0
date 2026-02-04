import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mocks are created before module loading
const mockPrisma = vi.hoisted(() => ({
    dispute: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
    },
}));

vi.mock('@/lib/core/db', () => ({
    prisma: mockPrisma,
}));

import { AdminDisputeService } from '@/lib/role/admin/disputes';

describe('AdminDisputeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('listDisputes', () => {
        it('should return disputes ordered by createdAt desc', async () => {
            const mockDisputes = [
                { id: 'd1', createdAt: new Date('2026-01-25'), initiator: {}, booking: {} },
                { id: 'd2', createdAt: new Date('2026-01-24'), initiator: {}, booking: {} },
            ];
            mockPrisma.dispute.findMany.mockResolvedValue(mockDisputes);

            const result = await AdminDisputeService.listDisputes();

            expect(result).toEqual(mockDisputes);
            expect(mockPrisma.dispute.findMany).toHaveBeenCalledWith({
                include: {
                    initiator: true,
                    booking: true,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
        });

        it('should return empty array when no disputes exist', async () => {
            mockPrisma.dispute.findMany.mockResolvedValue([]);

            const result = await AdminDisputeService.listDisputes();

            expect(result).toEqual([]);
        });
    });

    describe('getDisputeById', () => {
        it('should return dispute with nested payment relation', async () => {
            const mockDispute = {
                id: 'd1',
                bookingId: 'b1',
                initiator: { id: 'u1', email: 'user@test.com' },
                booking: {
                    id: 'b1',
                    payment: { id: 'p1', amountGross: 10000 },
                },
            };
            mockPrisma.dispute.findUnique.mockResolvedValue(mockDispute);

            const result = await AdminDisputeService.getDisputeById('d1');

            expect(result).toEqual(mockDispute);
            expect(mockPrisma.dispute.findUnique).toHaveBeenCalledWith({
                where: { id: 'd1' },
                include: {
                    initiator: true,
                    booking: {
                        include: {
                            payment: true,
                        },
                    },
                },
            });
        });

        it('should return null for non-existent dispute', async () => {
            mockPrisma.dispute.findUnique.mockResolvedValue(null);

            const result = await AdminDisputeService.getDisputeById('nonexistent');

            expect(result).toBeNull();
        });
    });
});
