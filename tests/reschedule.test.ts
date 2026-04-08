import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmReschedule, requestReschedule, rejectReschedule } from '@/lib/domain/bookings/transitions';
import {
    BookingStatus,
    PaymentStatus,
    RescheduleAwaitingParty,
    RescheduleProposalSource,
    Role,
} from '@prisma/client';
import { TransitionError } from '@/lib/domain/bookings/errors';
import { addHours } from 'date-fns';

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
        it('transitions an accepted booking into a candidate-authored proposal round', async () => {
            const slot = {
                start: addHours(new Date(), 30),
                end: addHours(new Date(), 30.5),
            };
            const booking = {
                id: 'booking-1',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
                rescheduleRound: 0,
            };

            mockPrisma.booking.findUnique.mockResolvedValueOnce(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = {
                ...booking,
                status: BookingStatus.reschedule_pending,
                rescheduleAwaitingParty: RescheduleAwaitingParty.PROFESSIONAL,
                rescheduleProposalSource: RescheduleProposalSource.CANDIDATE,
                rescheduleRound: 1,
            };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValueOnce(updatedBooking);

            const actor = { userId: 'cand-1', role: Role.CANDIDATE };
            const result = await requestReschedule(
                'booking-1',
                actor,
                [slot],
                'Conflict with meeting',
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.reschedule_pending);
            expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'booking-1' },
                data: expect.objectContaining({
                    status: BookingStatus.reschedule_pending,
                    rescheduleAwaitingParty: RescheduleAwaitingParty.PROFESSIONAL,
                    rescheduleProposalSource: RescheduleProposalSource.CANDIDATE,
                    rescheduleRound: 1,
                }),
            }));
        });

        it('allows the professional to submit a replacement proposal round when it is their turn', async () => {
            const slot = {
                start: addHours(new Date(), 36),
                end: addHours(new Date(), 36.5),
            };
            const booking = {
                id: 'booking-2',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
                rescheduleRound: 2,
                rescheduleAwaitingParty: RescheduleAwaitingParty.PROFESSIONAL,
            };

            mockPrisma.booking.findUnique.mockResolvedValueOnce(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = {
                ...booking,
                rescheduleAwaitingParty: RescheduleAwaitingParty.CANDIDATE,
                rescheduleProposalSource: RescheduleProposalSource.PROFESSIONAL,
                rescheduleRound: 3,
            };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValueOnce(updatedBooking);

            const actor = { userId: 'pro-1', role: Role.PROFESSIONAL };
            const result = await requestReschedule(
                'booking-2',
                actor,
                [slot],
                'Emergency conflict',
                { prisma: mockPrisma as any }
            );

            expect(result.rescheduleAwaitingParty).toBe(RescheduleAwaitingParty.CANDIDATE);
            expect(result.rescheduleRound).toBe(3);
            expect(mockPrisma.auditLog.create).toHaveBeenCalled();
        });

        it('throws when a participant tries to propose on the wrong turn', async () => {
            const booking = {
                id: 'booking-3',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                rescheduleAwaitingParty: RescheduleAwaitingParty.CANDIDATE,
                rescheduleRound: 1,
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            await expect(
                requestReschedule(
                    'booking-3',
                    { userId: 'pro-1', role: Role.PROFESSIONAL },
                    [{ start: new Date(), end: addHours(new Date(), 0.5) }],
                    undefined,
                    { prisma: mockPrisma as any }
                )
            ).rejects.toThrow(TransitionError);
        });
    });

    describe('confirmReschedule', () => {
        it('allows a professional to reschedule directly from accepted without entering pending', async () => {
            const newStartAt = addHours(new Date(), 48);
            const newEndAt = addHours(new Date(), 48.5);

            const booking = {
                id: 'booking-4',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.accepted,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);
            mockPrisma.booking.update.mockResolvedValue({
                ...booking,
                startAt: newStartAt,
                endAt: newEndAt,
            });

            const result = await confirmReschedule(
                'booking-4',
                { userId: 'pro-1', role: Role.PROFESSIONAL },
                newStartAt,
                newEndAt,
                { prisma: mockPrisma as any }
            );

            expect(result.startAt).toEqual(newStartAt);
            expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'booking-4' },
                data: expect.objectContaining({
                    startAt: newStartAt,
                    endAt: newEndAt,
                    rescheduleRound: 0,
                }),
            }));
        });

        it('accepts a proposed slot from an active reschedule round', async () => {
            const newStartAt = addHours(new Date(), 72);
            const newEndAt = addHours(new Date(), 72.5);

            const booking = {
                id: 'booking-5',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                startAt: addHours(new Date(), 24),
                endAt: addHours(new Date(), 24.5),
                priceCents: 10000,
                rescheduleAwaitingParty: RescheduleAwaitingParty.PROFESSIONAL,
                rescheduleProposalSlots: [
                    {
                        startAt: newStartAt.toISOString(),
                        endAt: newEndAt.toISOString(),
                    },
                ],
            };

            mockPrisma.booking.findUnique.mockResolvedValue(booking);
            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);

            const updatedBooking = {
                ...booking,
                status: BookingStatus.accepted,
                startAt: newStartAt,
                endAt: newEndAt,
                rescheduleAwaitingParty: null,
                rescheduleProposalSource: null,
                rescheduleProposalSlots: null,
                rescheduleRound: 0,
            };
            mockPrisma.booking.update.mockResolvedValue(updatedBooking);
            mockPrisma.booking.findUnique.mockResolvedValue(updatedBooking);

            const result = await confirmReschedule(
                'booking-5',
                { userId: 'pro-1', role: Role.PROFESSIONAL },
                newStartAt,
                newEndAt,
                { prisma: mockPrisma as any }
            );

            expect(result.status).toBe(BookingStatus.accepted);
            expect(mockPrisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    status: BookingStatus.accepted,
                    startAt: newStartAt,
                    endAt: newEndAt,
                    rescheduleRound: 0,
                }),
            }));
        });

        it('throws when the selected slot is not in the active proposal round', async () => {
            const booking = {
                id: 'booking-6',
                candidateId: 'cand-1',
                professionalId: 'pro-1',
                status: BookingStatus.reschedule_pending,
                rescheduleAwaitingParty: RescheduleAwaitingParty.CANDIDATE,
                rescheduleProposalSlots: [
                    {
                        startAt: addHours(new Date(), 30).toISOString(),
                        endAt: addHours(new Date(), 30.5).toISOString(),
                    },
                ],
            };

            mockPrisma.booking.findUniqueOrThrow.mockResolvedValue(booking);
            mockPrisma.booking.findUnique.mockResolvedValue(booking);

            await expect(
                confirmReschedule(
                    'booking-6',
                    { userId: 'cand-1', role: Role.CANDIDATE },
                    addHours(new Date(), 40),
                    addHours(new Date(), 40.5),
                    { prisma: mockPrisma as any }
                )
            ).rejects.toThrow(TransitionError);
        });
    });

    describe('rejectReschedule', () => {
        it('should transition to cancelled on rejection (early - refund)', async () => {
            const startAt = addHours(new Date(), 24);

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
            expect(mockPrisma.payment.update).toHaveBeenCalledWith({
                where: { bookingId: 'booking-7' },
                data: { status: PaymentStatus.refunded, refundedAmountCents: 10000 },
            });
        });
    });
});
