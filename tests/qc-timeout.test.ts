import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QCService, estimateStripeFeeCents } from '@/lib/domain/qc/services';
import { prisma } from '@/lib/core/db';
import { qcQueue, notificationsQueue } from '@/lib/queues';
import { BookingStatus, QCStatus } from '@prisma/client';
import { createCapturedPaymentIntent, createConnectedAccount, stripeTest } from './helpers/stripe-live';

vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        callFeedback: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        payment: {
            update: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
        $transaction: vi.fn((ops) => Promise.all(ops)),
    },
}));

vi.mock('@/lib/queues', () => ({
    qcQueue: {
        add: vi.fn(),
    },
    notificationsQueue: {
        add: vi.fn(),
    },
    paymentsQueue: {
        add: vi.fn(),
    },
}));

vi.mock('@/lib/integrations/claude', () => ({
    ClaudeService: {
        validateFeedback: vi.fn(),
    },
}));

vi.mock('@/lib/shared/qc', () => ({
    validateFeedbackRequirements: vi.fn().mockReturnValue({ passed: true, reasons: [] }),
}));

describe('QC Timeout Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Scheduling', () => {
        it('should schedule timeout and nudges when QC returns revise', async () => {
            const mockBookingId = `booking-${Date.now()}`;

            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                feedback: { text: 'content', actions: [] },
                professional: {},
            } as any);

            const { ClaudeService } = await import('@/lib/integrations/claude');
            vi.mocked(ClaudeService.validateFeedback).mockResolvedValue({
                passed: false,
                reasons: ['revise_please'],
            });

            await QCService.processQCJob(mockBookingId);

            expect(qcQueue.add).toHaveBeenCalledWith(
                'qc-timeout',
                { bookingId: mockBookingId },
                expect.objectContaining({ delay: 7 * 24 * 60 * 60 * 1000 })
            );

            expect(notificationsQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ type: 'feedback_revise_nudge' }),
                expect.objectContaining({ delay: 24 * 60 * 60 * 1000 })
            );
        });
    });

    describe('Timeout Execution', () => {
        it('should calculate 50% net and process live refund/transfer', async () => {
            const mockBookingId = `booking-${Date.now()}`;
            const connectedAccount = await createConnectedAccount();
            const captured = await createCapturedPaymentIntent(10_000);
            const paymentIntentWithFee = await stripeTest.paymentIntents.retrieve(captured.paymentIntent.id, {
                expand: ['latest_charge.balance_transaction'],
            });
            let feeCents = estimateStripeFeeCents(10_000);
            if (paymentIntentWithFee.latest_charge && typeof paymentIntentWithFee.latest_charge !== 'string') {
                const balanceTransaction = paymentIntentWithFee.latest_charge.balance_transaction;
                if (balanceTransaction && typeof balanceTransaction !== 'string') {
                    feeCents = balanceTransaction.fee;
                }
            }
            const expectedShare = Math.floor((10_000 - feeCents) / 2);

            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                status: BookingStatus.accepted,
                payment: {
                    stripePaymentIntentId: captured.paymentIntent.id,
                    amountGross: 10000,
                },
                professional: {
                    stripeAccountId: connectedAccount.id,
                },
            } as any);

            vi.mocked(prisma.callFeedback.findUnique).mockResolvedValue({
                qcStatus: QCStatus.revise,
            } as any);

            await QCService.handleTimeout(mockBookingId);

            const refunds = await stripeTest.refunds.list({
                payment_intent: captured.paymentIntent.id,
                limit: 5,
            });
            expect(refunds.data.length).toBeGreaterThan(0);
            expect(refunds.data[0].amount).toBe(expectedShare);

            const transfers = await stripeTest.transfers.list({ limit: 100 });
            const timeoutTransfer = transfers.data.find(
                (transfer) => transfer.transfer_group === mockBookingId
            );
            expect(timeoutTransfer).toBeDefined();
            expect(timeoutTransfer?.destination).toBe(connectedAccount.id);
            expect(timeoutTransfer?.source_transaction).toBe(captured.chargeId);

            expect(prisma.booking.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: mockBookingId },
                    data: { status: BookingStatus.completed },
                })
            );
        });
    });

    describe('Fee Fallback Helper', () => {
        it('should estimate fee using 2.9% + 30c formula', () => {
            expect(estimateStripeFeeCents(10_000)).toBe(320);
            expect(estimateStripeFeeCents(5_000)).toBe(175);
        });
    });
});
