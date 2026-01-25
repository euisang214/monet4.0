import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isLateCancellation } from '@/lib/domain/bookings/utils';
import { cancelBooking } from '@/lib/domain/bookings/transitions';
import { BookingStatus, PaymentStatus, Role, PayoutStatus } from '@prisma/client';
import { addHours, subHours } from 'date-fns';

// Prepare mocks for integration test
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

describe('Cancellations Domain', () => {
    describe('isLateCancellation', () => {
        it('should return true if cancelled within 6 hours of start', () => {
            const startAt = new Date();
            const cancelledAt = subHours(startAt, 5); // 5 hours before
            // Note: utils uses differenceInHours(startAt, cancelledAt)
            // if cancelledAt is 5 hours BEFORE startAt, diff is 5. 5 < 6 is true.

            // Let's use concrete dates to be sure
            // Start: 12:00
            // Cancel: 07:00 -> 5 hours diff. Late? Yes (<6).
            const start = new Date('2024-01-01T12:00:00Z');
            const cancel = new Date('2024-01-01T07:00:00Z');
            expect(isLateCancellation(start, cancel)).toBe(true);
        });

        it('should return false if cancelled more than 6 hours before start', () => {
            const start = new Date('2024-01-01T12:00:00Z');
            const cancel = new Date('2024-01-01T05:00:00Z'); // 7 hours before
            expect(isLateCancellation(start, cancel)).toBe(false);
        });

        it('should return false exactly at 6 hours boundary (edge case)', () => {
            // date-fns differenceInHours rounds towards 0? No, it truncates.
            // 2024-01-01T12:00 - 2024-01-01T06:00 = 6 hours. 6 < 6 is false.
            const start = new Date('2024-01-01T12:00:00Z');
            const cancel = new Date('2024-01-01T06:00:00Z');
            expect(isLateCancellation(start, cancel)).toBe(false);
        });
    });

    describe('cancelBooking Integration', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should trigger payout on late cancellation', async () => {
            // Setup late cancellation scenario
            // 2 hours away
            const startAt = addHours(new Date(), 2);

            const booking = {
                id: 'booking-late',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt,
                priceCents: 10000,
            };

            const payment = {
                bookingId: 'booking-late',
                status: PaymentStatus.held,
                amountGross: 10000,
                platformFee: 2000,
            };

            const professional = {
                id: 'pro-1',
                stripeAccountId: 'acct_test',
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);
            // Mock findUnique for invariant checks
            mockPrisma.booking.findUnique.mockResolvedValue(booking);

            mockPrisma.payment.findUnique.mockResolvedValue(payment);
            mockPrisma.user.findUnique.mockResolvedValue(professional);

            // Mock update to return valid booking for invariant check
            const updatedBooking = { ...booking, status: BookingStatus.cancelled, candidateLateCancellation: true, payment: { status: PaymentStatus.released } };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking); // Return updated for invariant check

            // Execute
            const actor = { userId: 'cand-1', role: Role.CANDIDATE };
            await cancelBooking('booking-late', actor, 'Sick', undefined, { prisma: mockPrisma as any });

            // Assert
            // 1. Payment Released
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { bookingId: 'booking-late' },
                data: { status: PaymentStatus.released }
            });

            // 2. Payout Created
            expect(mockPrisma.payout.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    bookingId: 'booking-late',
                    amountNet: 8000, // 10000 - 2000
                    status: PayoutStatus.pending
                })
            }));

            // 3. Booking Cancelled with late flag
            expect(mockPrisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-late' },
                data: expect.objectContaining({
                    status: BookingStatus.cancelled,
                    candidateLateCancellation: true
                })
            });
        });

        it('should NOT trigger payout on early cancellation', async () => {
            // Setup early cancellation scenario (> 7 hours)
            const startAt = addHours(new Date(), 8);

            const booking = {
                id: 'booking-early',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt,
                priceCents: 10000,
            };

            const payment = {
                bookingId: 'booking-early',
                status: PaymentStatus.held,
                amountGross: 10000,
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);
            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.payment.findUnique.mockResolvedValue(payment);

            const updatedBooking = { ...booking, status: BookingStatus.cancelled, candidateLateCancellation: false, payment: { status: PaymentStatus.refunded } };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            // Execute
            const actor = { userId: 'cand-1', role: Role.CANDIDATE };
            await cancelBooking('booking-early', actor, 'Plans changed', undefined, { prisma: mockPrisma as any });

            // Assert
            // 1. Payment Refunded
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { bookingId: 'booking-early' },
                data: { status: PaymentStatus.refunded, refundedAmountCents: 10000 }
            });

            // 2. No Payout Created
            expect(mockPrisma.payout.create).not.toHaveBeenCalled();

            // 3. Booking Cancelled without late flag
            expect(mockPrisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-early' },
                data: expect.objectContaining({
                    status: BookingStatus.cancelled,
                    candidateLateCancellation: false
                })
            });
        });
    });
});
