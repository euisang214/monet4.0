import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestReschedule, confirmReschedule, rejectReschedule } from '@/lib/domain/bookings/transitions';
import { BookingStatus, PaymentStatus, Role, PayoutStatus } from '@prisma/client';
import { TransitionConflictError, TransitionError } from '@/lib/domain/bookings/errors';
import { addHours, subHours } from 'date-fns';

// Mock Prisma
const mockPrisma = {
    $transaction: vi.fn(async (callback) => callback(mockPrisma)),
    booking: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
    },
    payment: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
    },
    user: {
        findUnique: vi.fn(),
    },
    payout: {
        create: vi.fn(),
    },
    auditLog: {
        create: vi.fn(),
    },
};

describe('Rescheduling Domain', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('requestReschedule', () => {
        it('should transition accepted booking to reschedule_pending', async () => {
            const booking = {
                id: 'booking-1',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = { ...booking, status: BookingStatus.reschedule_pending };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            const actor = { userId: 'cand-1', role: Role.CANDIDATE };
            const result = await requestReschedule(
                'booking-1',
                actor,
                [{ start: new Date(), end: new Date() }],
                'Conflict with meeting',
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.reschedule_pending);
            expect(mockPrisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-1' },
                data: { status: BookingStatus.reschedule_pending },
            });
            expect(mockPrisma.auditLog.create).toHaveBeenCalled();
        });

        it('should allow professional to request reschedule', async () => {
            const booking = {
                id: 'booking-2',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = { ...booking, status: BookingStatus.reschedule_pending };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await requestReschedule(
                'booking-2',
                actor,
                undefined,
                'Emergency conflict',
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.reschedule_pending);
        });

        it('should no-op when booking is already reschedule_pending', async () => {
            const booking = {
                id: 'booking-2b',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await requestReschedule(
                'booking-2b',
                actor,
                undefined,
                'Retry request',
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.reschedule_pending);
            expect(mockPrisma.booking.update).not.toHaveBeenCalled();
        });

        it('should throw TransitionError when booking is not accepted', async () => {
            const booking = {
                id: 'booking-3',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.requested, // Not accepted
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'cand-1', role: Role.CANDIDATE };
            await expect(
                requestReschedule('booking-3', actor, [], undefined, { prisma: mockPrisma as any })
            ).rejects.toThrow(TransitionError);
        });

        it('should throw TransitionError when user is not participant', async () => {
            const booking = {
                id: 'booking-4',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'other-user', role: Role.CANDIDATE };
            await expect(
                requestReschedule('booking-4', actor, [], undefined, { prisma: mockPrisma as any })
            ).rejects.toThrow(TransitionError);
        });
    });

    describe('confirmReschedule', () => {
        it('should transition reschedule_pending to accepted with new times', async () => {
            const newStartAt = addHours(new Date(), 48);
            const newEndAt = addHours(new Date(), 48.5);

            const booking = {
                id: 'booking-5',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                startAt: addHours(new Date(), 24), // Old time
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = {
                ...booking,
                status: BookingStatus.accepted,
                startAt: newStartAt,
                endAt: newEndAt,
            };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await confirmReschedule(
                'booking-5',
                actor,
                newStartAt,
                newEndAt,
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.accepted);
            expect(mockPrisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-5' },
                data: {
                    status: BookingStatus.accepted,
                    startAt: newStartAt,
                    endAt: newEndAt,
                },
            });
        });

        it('should no-op when already accepted with the same times', async () => {
            const existingStartAt = addHours(new Date(), 24);
            const existingEndAt = addHours(existingStartAt, 0.5);

            const booking = {
                id: 'booking-5b',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt: existingStartAt,
                endAt: existingEndAt,
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await confirmReschedule(
                'booking-5b',
                actor,
                existingStartAt,
                existingEndAt,
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.accepted);
            expect(mockPrisma.booking.update).not.toHaveBeenCalled();
        });

        it('should throw TransitionConflictError when already accepted with different times', async () => {
            const booking = {
                id: 'booking-6',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);
            mockPrisma.booking.findUnique.mockResolvedValue(booking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            await expect(
                confirmReschedule('booking-6', actor, new Date(), new Date(), { prisma: mockPrisma as any })
            ).rejects.toThrow(TransitionConflictError);
        });

        it('should throw TransitionError when booking is not reschedule_pending', async () => {
            const booking = {
                id: 'booking-6b',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.requested,
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);
            mockPrisma.booking.findUnique.mockResolvedValue(booking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            await expect(
                confirmReschedule('booking-6b', actor, new Date(), new Date(), { prisma: mockPrisma as any })
            ).rejects.toThrow(TransitionError);
        });
    });

    describe('rejectReschedule', () => {
        it('should transition to cancelled on rejection (early - refund)', async () => {
            const startAt = addHours(new Date(), 24); // 24 hours away (> 6 hours)

            const booking = {
                id: 'booking-7',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                startAt,
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = {
                ...booking,
                status: BookingStatus.cancelled,
                candidateLateCancellation: false,
                payment: { status: PaymentStatus.refunded },
            };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await rejectReschedule('booking-7', actor, { prisma: mockPrisma as any });

            expect(result.status).toBe(BookingStatus.cancelled);
            // Early rejection = refund
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { bookingId: 'booking-7' },
                data: { status: PaymentStatus.refunded, refundedAmountCents: 10000 },
            });
        });

        it('should transition to cancelled on rejection (late - payout)', async () => {
            const startAt = addHours(new Date(), 2); // 2 hours away (< 6 hours = late)

            const booking = {
                id: 'booking-8',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                startAt,
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = {
                ...booking,
                status: BookingStatus.cancelled,
                candidateLateCancellation: true,
                payment: { status: PaymentStatus.released },
            };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await rejectReschedule('booking-8', actor, { prisma: mockPrisma as any });

            expect(result.status).toBe(BookingStatus.cancelled);
            // Late rejection = payout
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { bookingId: 'booking-8' },
                data: { status: PaymentStatus.released },
            });
        });

        it('should throw TransitionError when booking is not reschedule_pending', async () => {
            const booking = {
                id: 'booking-9',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            await expect(
                rejectReschedule('booking-9', actor, { prisma: mockPrisma as any })
            ).rejects.toThrow(TransitionError);
        });
    });
});
