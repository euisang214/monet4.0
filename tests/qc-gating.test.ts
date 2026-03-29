import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QCService } from '@/lib/domain/qc/services';
import { PaymentsService } from '@/lib/domain/payments/services';
import { prisma } from '@/lib/core/db';
import { paymentsQueue } from '@/lib/queues';
import { createCapturedPaymentIntent, createConnectedAccount, stripeTest } from './helpers/stripe-live';

type BookingRecord = NonNullable<Awaited<ReturnType<typeof prisma.booking.findUnique>>>;
type PayoutRecord = NonNullable<Awaited<ReturnType<typeof prisma.payout.findUnique>>>;
type PayoutUpsertRecord = Awaited<ReturnType<typeof prisma.payout.upsert>>;

vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: { findUnique: vi.fn(), update: vi.fn() },
        callFeedback: { update: vi.fn() },
        payout: {
            upsert: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        $transaction: vi.fn(async (args) => {
            if (Array.isArray(args)) {
                return Promise.all(args);
            }
            return args(prisma);
        }),
    },
}));

vi.mock('@/lib/domain/bookings/transitions', () => ({
    completeBooking: vi.fn()
}));

vi.mock('@/lib/integrations/claude', () => ({
    ClaudeService: {
        validateFeedback: vi.fn(),
    },
}));

vi.mock('@/lib/queues', () => ({
    paymentsQueue: {
        add: vi.fn(),
    },
    notificationsQueue: {
        add: vi.fn(),
    },
    qcQueue: {
        add: vi.fn(),
    },
}));

describe('QC Gating Flow', () => {
    const mockBookingId = 'booking_123';
    const mockStripeAccountId = 'acct_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('QC Service', () => {
        it('should fail validation if word count is too low', async () => {
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                feedback: {
                    text: 'Too short',
                    actions: ['Action 1', 'Action 2', 'Action 3'],
                },
                professional: { stripeAccountId: mockStripeAccountId },
            } as BookingRecord);

            await QCService.processQCJob(mockBookingId);

            expect(prisma.callFeedback.update).toHaveBeenCalledWith({
                where: { bookingId: mockBookingId },
                data: expect.objectContaining({
                    qcStatus: 'revise',
                    qcReasons: ['Word count is 2, minimum required is 200.'],
                    qcReviewedAt: expect.any(Date),
                }),
            });
            expect(prisma.payout.upsert).not.toHaveBeenCalled();
        });

        it('should pass if valid and enqueue payment', async () => {
            const longText = 'word '.repeat(201);
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                priceCents: 10000,
                feedback: {
                    text: longText,
                    actions: ['Action 1', 'Action 2', 'Action 3'],
                },
                professional: { stripeAccountId: mockStripeAccountId },
            } as BookingRecord);

            const { ClaudeService } = await import('@/lib/integrations/claude');
            vi.mocked(ClaudeService.validateFeedback).mockResolvedValue({
                passed: true,
                reasons: [],
            });

            vi.mocked(prisma.payout.upsert).mockResolvedValue({
                status: 'pending',
            } as PayoutUpsertRecord);

            await QCService.processQCJob(mockBookingId);

            expect(prisma.callFeedback.update).toHaveBeenCalledWith({
                where: { bookingId: mockBookingId },
                data: expect.objectContaining({
                    qcStatus: 'passed',
                    qcReasons: [],
                    qcReviewedAt: expect.any(Date),
                }),
            });

            const { completeBooking } = await import('@/lib/domain/bookings/transitions');
            expect(completeBooking).toHaveBeenCalledWith(mockBookingId);

            expect(prisma.payout.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { bookingId: mockBookingId },
                    create: expect.objectContaining({
                        amountNet: 8000,
                        status: 'pending',
                    }),
                })
            );

            expect(paymentsQueue.add).toHaveBeenCalledWith('process-payout', { bookingId: mockBookingId });
        });

        it('should fail if Claude rejects quality', async () => {
            const longText = 'word '.repeat(201);
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                feedback: {
                    text: longText,
                    actions: ['Action 1', 'Action 2', 'Action 3'],
                },
                professional: { stripeAccountId: mockStripeAccountId },
            } as BookingRecord);

            const { ClaudeService } = await import('@/lib/integrations/claude');
            vi.mocked(ClaudeService.validateFeedback).mockResolvedValue({
                passed: false,
                reasons: ['Content is repetitive'],
            });

            await QCService.processQCJob(mockBookingId);

            expect(prisma.callFeedback.update).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ qcStatus: 'passed' }),
                })
            );
            expect(prisma.callFeedback.update).toHaveBeenCalledWith({
                where: { bookingId: mockBookingId },
                data: expect.objectContaining({
                    qcStatus: 'revise',
                    qcReasons: ['Content is repetitive'],
                    qcReviewedAt: expect.any(Date),
                }),
            });
            const { notificationsQueue } = await import('@/lib/queues');
            expect(notificationsQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({
                    type: 'feedback_revise',
                    reasons: ['Content is repetitive'],
                })
            );
        });
    });

    describe('Payments Service', () => {
        it('should be idempotent (skip if already paid)', async () => {
            vi.mocked(prisma.payout.findUnique).mockResolvedValue({
                id: 'payout_123',
                status: 'paid',
                booking: {
                    payment: { stripePaymentIntentId: 'pi_unused' },
                },
            } as PayoutRecord);

            const result = await PaymentsService.processPayoutJob(mockBookingId);
            expect(result.status).toBe('already_paid');
        });

        it('should execute transfer if pending', async () => {
            const connectedAccount = await createConnectedAccount();
            const captured = await createCapturedPaymentIntent(10_000);

            vi.mocked(prisma.payout.findUnique).mockResolvedValue({
                id: 'payout_123',
                status: 'pending',
                amountNet: 8000,
                proStripeAccountId: connectedAccount.id,
                booking: {
                    payment: {
                        stripePaymentIntentId: captured.paymentIntent.id,
                    },
                },
            } as PayoutRecord);

            await PaymentsService.processPayoutJob(mockBookingId);

            expect(prisma.payout.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'payout_123' },
                    data: expect.objectContaining({
                        status: 'paid',
                    }),
                })
            );

            const firstUpdateCall = vi.mocked(prisma.payout.update).mock.calls[0]?.[0] as
                | { data?: { stripeTransferId?: string | null } }
                | undefined;
            const transferId = firstUpdateCall?.data?.stripeTransferId;
            expect(typeof transferId).toBe('string');
            expect(transferId.startsWith('tr_')).toBe(true);

            const transfer = await stripeTest.transfers.retrieve(transferId);
            expect(transfer.destination).toBe(connectedAccount.id);
            expect(transfer.source_transaction).toBe(captured.chargeId);
        });
    });
});
