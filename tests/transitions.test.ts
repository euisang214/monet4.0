import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptBooking, cancelBooking, completeBooking } from '@/lib/domain/bookings/transitions';
import { BookingStatus, PaymentStatus, Role, QCStatus, PayoutStatus } from '@prisma/client';
import { StateInvariantError, TransitionError } from '@/lib/domain/bookings/errors';

// Mock dependencies
const mockBooking = {
    id: 'booking-123',
    candidateId: 'user-cand',
    professionalId: 'user-pro',
    status: BookingStatus.requested,
    payment: { status: PaymentStatus.authorized },
    payout: { status: PayoutStatus.pending },
    feedback: null,
    priceCents: 10000,
    startAt: new Date(Date.now() + 86400000), // 24h from now
    endAt: new Date(Date.now() + 86400000 + 1800000),
    candidateLateCancellation: false,
};

const mockPrisma = {
    $transaction: vi.fn(async (callback) => callback(mockPrisma)),
    booking: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
    },
    payment: {
        updateMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
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

describe('Booking State Machine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should accept a requested booking and hold funds', async () => {
        // Setup
        const initialBooking = { ...mockBooking, status: BookingStatus.requested };
        const updatedBooking = { ...initialBooking, status: BookingStatus.accepted, payment: { status: PaymentStatus.held } };

        mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking)); // Lock
        mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking)); // Check inside updateFn

        mockPrisma.booking.update.mockResolvedValue(updatedBooking); // Return from update
        mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking)); // Invariant check

        const actor = { userId: 'user-pro', role: Role.PROFESSIONAL };

        // Execute
        const result = await acceptBooking('booking-123', actor, { prisma: mockPrisma as any });

        // Assert
        expect(result.status).toBe(BookingStatus.accepted);
        expect(mockPrisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-123' },
            data: { status: BookingStatus.accepted },
        });
        expect(mockPrisma.payment.updateMany).toHaveBeenCalledWith({
            where: { bookingId: 'booking-123', status: PaymentStatus.authorized },
            data: { status: PaymentStatus.held },
        });
        expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('should fail invariant if completing booking without QC pass', async () => {
        // Setup: completed_pending_feedback -> completed
        const initialBooking = { ...mockBooking, status: BookingStatus.completed_pending_feedback };
        const updatedBooking = { ...initialBooking, status: BookingStatus.completed, feedback: { qcStatus: QCStatus.missing } };

        mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
        mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
        mockPrisma.booking.update.mockResolvedValue(updatedBooking);
        mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking)); // Invariant check

        // Execute & Assert
        await expect(completeBooking('booking-123', { prisma: mockPrisma as any }))
            .rejects
            .toThrow(StateInvariantError);
    });

    it('should mark late cancellation if candidate cancels < 6h', async () => {
        const startAt = new Date(Date.now() + 3600000); // 1 hour from now
        const initialBooking = {
            ...mockBooking,
            status: BookingStatus.accepted,
            startAt,
            payment: {
                status: PaymentStatus.held,
                amountGross: 12000,
                platformFee: 2400,
            }
        };

        const updatedBooking = {
            ...initialBooking,
            status: BookingStatus.cancelled,
            candidateLateCancellation: true,
            payment: { status: PaymentStatus.released }
        };

        const mockProfessional = {
            id: 'user-pro',
            stripeAccountId: 'acct_123',
        };

        mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
        mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));

        mockPrisma.payment.findUnique.mockResolvedValue(initialBooking.payment);
        mockPrisma.user.findUnique.mockResolvedValue(mockProfessional);

        mockPrisma.booking.update.mockResolvedValue(updatedBooking);
        mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

        const actor = { userId: 'user-cand', role: Role.CANDIDATE };

        await cancelBooking('booking-123', actor, 'Just because', undefined, { prisma: mockPrisma as any });

        expect(mockPrisma.payment.update).toHaveBeenCalledWith({
            where: { bookingId: 'booking-123' },
            data: { status: PaymentStatus.released },
        });

        expect(mockPrisma.payout.create).toHaveBeenCalledWith({
            data: {
                bookingId: 'booking-123',
                proStripeAccountId: 'acct_123',
                amountNet: 9600,
                status: PayoutStatus.pending,
            }
        });

        expect(mockPrisma.booking.update).toHaveBeenCalledWith({
            where: { id: 'booking-123' },
            data: {
                status: BookingStatus.cancelled,
                candidateLateCancellation: true,
                attendanceOutcome: undefined,
            },
        });
    });

    describe('Invalid Transitions', () => {
        it('should throw TransitionError when accepting a booking that is not requested', async () => {
            const booking = { ...mockBooking, status: BookingStatus.draft };
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'user-pro', role: Role.PROFESSIONAL };
            await expect(acceptBooking('booking-123', actor, { prisma: mockPrisma as any }))
                .rejects
                .toThrow(TransitionError);
        });

        it('should throw TransitionError when unauthorized user tries to accept', async () => {
            const booking = { ...mockBooking, status: BookingStatus.requested };
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'user-other', role: Role.PROFESSIONAL }; // Wrong user
            await expect(acceptBooking('booking-123', actor, { prisma: mockPrisma as any }))
                .rejects
                .toThrow(TransitionError);
        });

        it('should throw TransitionError when cancelling a completed booking', async () => {
            const booking = { ...mockBooking, status: BookingStatus.completed };
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const actor = { userId: 'user-cand', role: Role.CANDIDATE };
            await expect(cancelBooking('booking-123', actor, undefined, undefined, { prisma: mockPrisma as any }))
                .rejects
                .toThrow(TransitionError);
        });
    });

    describe('State Invariants (CLAUDE.md #940-952)', () => {
        // Invariant 1: PaymentStatus = refunded ⇒ BookingStatus ∈ {cancelled, refunded, declined, expired}
        it('should throw StateInvariantError when payment is refunded but booking status is invalid', async () => {
            // Use cancelled -> completed transition (simulating corrupted state after update)
            const initialBooking = {
                ...mockBooking,
                status: BookingStatus.completed_pending_feedback,
                payment: { status: PaymentStatus.held },
                feedback: { qcStatus: QCStatus.passed },
            };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.completed, // Not in {cancelled, refunded, declined, expired}
                payment: { status: PaymentStatus.refunded }, // But payment is refunded
                feedback: { qcStatus: QCStatus.passed },
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            await expect(completeBooking('booking-123', { prisma: mockPrisma as any }))
                .rejects
                .toThrow(StateInvariantError);
        });

        // Invariant 2: PaymentStatus = released ⇒ QCStatus = passed OR candidateLateCancellation = true
        it('should throw StateInvariantError when payment released without QC pass and not late cancellation', async () => {
            const initialBooking = { ...mockBooking, status: BookingStatus.accepted };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.cancelled,
                payment: { status: PaymentStatus.released },
                feedback: { qcStatus: QCStatus.missing }, // Not passed
                candidateLateCancellation: false, // Not late cancellation
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.payment.findUnique.mockResolvedValue({ amountGross: 10000, platformFee: 2000, status: PaymentStatus.held });
            mockPrisma.user.findUnique.mockResolvedValue({ stripeAccountId: 'acct_test' });
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            const actor = { userId: 'user-cand', role: Role.CANDIDATE };
            await expect(cancelBooking('booking-123', actor, 'reason', undefined, { prisma: mockPrisma as any }))
                .rejects
                .toThrow(StateInvariantError);
        });

        // Invariant 3: PayoutStatus = blocked ⇒ PaymentStatus ∈ {held, refunded}
        it('should throw StateInvariantError when payout blocked but payment status is invalid', async () => {
            const initialBooking = { ...mockBooking, status: BookingStatus.completed_pending_feedback };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.completed,
                payment: { status: PaymentStatus.released }, // Invalid: should be held or refunded
                payout: { status: PayoutStatus.blocked },
                feedback: { qcStatus: QCStatus.passed },
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            await expect(completeBooking('booking-123', { prisma: mockPrisma as any }))
                .rejects
                .toThrow(StateInvariantError);
        });

        // Invariant 4: PayoutStatus = paid ⇒ PaymentStatus = released
        it('should throw StateInvariantError when payout paid but payment not released', async () => {
            const initialBooking = { ...mockBooking, status: BookingStatus.completed_pending_feedback };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.completed,
                payment: { status: PaymentStatus.held }, // Invalid: should be released
                payout: { status: PayoutStatus.paid },
                feedback: { qcStatus: QCStatus.passed },
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            await expect(completeBooking('booking-123', { prisma: mockPrisma as any }))
                .rejects
                .toThrow(StateInvariantError);
        });

        // Invariant 5: BookingStatus = accepted ⇒ startAt and endAt must be set
        it('should throw StateInvariantError when booking accepted without startAt/endAt', async () => {
            const initialBooking = {
                ...mockBooking,
                status: BookingStatus.requested,
                startAt: null,
                endAt: null,
                payment: { status: PaymentStatus.authorized },
            };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.accepted,
                payment: { status: PaymentStatus.held },
                startAt: null, // Missing - violates invariant 5
                endAt: null, // Missing
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            const actor = { userId: 'user-pro', role: Role.PROFESSIONAL };
            await expect(acceptBooking('booking-123', actor, { prisma: mockPrisma as any }))
                .rejects
                .toThrow(StateInvariantError);
        });

        // Invariant 6: BookingStatus = completed ⇒ qcStatus = passed
        // (Already tested in "should fail invariant if completing booking without QC pass")

        // Invariant 7: PaymentStatus = authorized ⇒ BookingStatus ∈ {requested, declined, expired}
        it('should throw StateInvariantError when payment authorized but booking status is invalid', async () => {
            const initialBooking = {
                ...mockBooking,
                status: BookingStatus.requested,
                startAt: null,
                endAt: null,
                payment: { status: PaymentStatus.authorized },
            };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.accepted, // Invalid: authorized should only be with requested/declined/expired
                payment: { status: PaymentStatus.authorized }, // Still authorized (bug scenario)
                startAt: new Date(), // Set to pass Invariant 5
                endAt: new Date(),
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            const actor = { userId: 'user-pro', role: Role.PROFESSIONAL };
            await expect(acceptBooking('booking-123', actor, { prisma: mockPrisma as any }))
                .rejects
                .toThrow(StateInvariantError);
        });

        // Valid invariant combinations
        it('should pass invariant check when payment released WITH candidateLateCancellation=true', async () => {
            const startAt = new Date(Date.now() + 3600000); // 1 hour from now (late)
            const initialBooking = {
                ...mockBooking,
                status: BookingStatus.accepted,
                startAt,
                payment: { status: PaymentStatus.held, amountGross: 10000, platformFee: 2000 },
            };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.cancelled,
                payment: { status: PaymentStatus.released },
                candidateLateCancellation: true, // Valid: late cancellation allows released payment
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.payment.findUnique.mockResolvedValue(initialBooking.payment);
            mockPrisma.user.findUnique.mockResolvedValue({ stripeAccountId: 'acct_123' });
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            const actor = { userId: 'user-cand', role: Role.CANDIDATE };

            // Should NOT throw
            const result = await cancelBooking('booking-123', actor, 'reason', undefined, { prisma: mockPrisma as any });
            expect(result.candidateLateCancellation).toBe(true);
        });

        it('should pass invariant check when payment released WITH QC passed', async () => {
            const initialBooking = {
                ...mockBooking,
                status: BookingStatus.completed_pending_feedback,
                payment: { status: PaymentStatus.held },
                payout: null,
                feedback: { qcStatus: QCStatus.passed },
            };
            const updatedBooking = {
                ...initialBooking,
                status: BookingStatus.completed,
                payment: { status: PaymentStatus.released },
                payout: { status: PayoutStatus.paid },
                feedback: { qcStatus: QCStatus.passed }, // Valid: QC passed allows released payment
            };

            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(initialBooking));
            mockPrisma.booking.findUniqueOrThrow.mockReturnValue(Promise.resolve(initialBooking));
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockReturnValueOnce(Promise.resolve(updatedBooking));

            // Should NOT throw
            const result = await completeBooking('booking-123', { prisma: mockPrisma as any });
            expect(result.status).toBe(BookingStatus.completed);
        });
    });
});
