import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, Role, DisputeStatus } from '@prisma/client';

// Inline mocks
vi.mock('@/lib/core/db', () => {
    const mockPrisma = {
        booking: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
        professionalRating: { findUnique: vi.fn(), create: vi.fn() },
        dispute: { create: vi.fn() },
        auditLog: { create: vi.fn() },
        $transaction: vi.fn((callback) => callback(mockPrisma)),
    };
    return { prisma: mockPrisma };
});

import { ReviewsService } from '@/lib/domain/reviews/service';
import { requestReschedule, initiateDispute } from '@/lib/domain/bookings/transitions';
import { prisma } from '@/lib/core/db';

describe('Post-Booking Domain Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('ReviewsService', () => {
        it('createReview should create rating if completed', async () => {
            // @ts-ignore
            prisma.booking.findUnique.mockResolvedValue({ id: 'b1', candidateId: 'c1', status: BookingStatus.completed });
            // @ts-ignore
            prisma.professionalRating.findUnique.mockResolvedValue(null);
            // @ts-ignore
            prisma.professionalRating.create.mockResolvedValue({ id: 'r1' });

            await ReviewsService.createReview('c1', { bookingId: 'b1', rating: 5, text: 'Good', timezone: 'UTC' });

            expect(prisma.professionalRating.create).toHaveBeenCalled();
        });

        it('createReview should throw if not completed', async () => {
            // @ts-ignore
            prisma.booking.findUnique.mockResolvedValue({ id: 'b1', candidateId: 'c1', status: BookingStatus.accepted });

            await expect(ReviewsService.createReview('c1', { bookingId: 'b1', rating: 5, text: 'Good', timezone: 'UTC' }))
                .rejects.toThrow('Can only review completed bookings');
        });
    });

    describe('Transitions Extensions', () => {
        it('requestReschedule should include slots in metadata', async () => {
            // @ts-ignore
            prisma.booking.findUnique.mockResolvedValue({ id: 'b1', status: BookingStatus.accepted, candidateId: 'c1', professionalId: 'p1', startAt: new Date(), endAt: new Date() });
            // @ts-ignore
            prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1', status: BookingStatus.accepted, candidateId: 'c1', professionalId: 'p1', startAt: new Date(), endAt: new Date() });

            const slots = [{ start: new Date(), end: new Date() }];

            await requestReschedule('b1', { userId: 'c1', role: Role.CANDIDATE }, slots, 'reason');

            expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    metadata: expect.objectContaining({ slots })
                })
            }));
        });

        it('initiateDispute should create dispute record', async () => {
            // @ts-ignore
            prisma.booking.findUnique.mockResolvedValue({ id: 'b1' });
            // @ts-ignore
            prisma.booking.findUniqueOrThrow.mockResolvedValue({ id: 'b1' });

            await initiateDispute('b1', { userId: 'c1', role: Role.CANDIDATE }, 'no_show', 'He did not show up');

            expect(prisma.dispute.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    description: 'He did not show up',
                    reason: 'no_show'
                })
            }));
            expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                data: { status: BookingStatus.dispute_pending }
            }));
        });
    });
});
