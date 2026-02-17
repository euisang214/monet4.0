import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDispute } from '@/lib/domain/admin/disputes';
import { prisma } from '@/lib/core/db';
import { createCapturedPaymentIntent, createConnectedAccount, stripeTest } from './helpers/stripe-live';
import { TransitionConflictError } from '@/lib/domain/bookings/errors';

vi.mock('@/lib/core/db', () => ({
    prisma: {
        dispute: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        booking: {
            update: vi.fn(),
        },
        payment: {
            update: vi.fn(),
        },
        payout: {
            create: vi.fn(),
            update: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
        $transaction: vi.fn((ops) => Promise.all(ops)),
    },
}));

describe('Admin Dispute Resolution (Live Stripe)', () => {
    const mockDisputeId = 'dispute_123';
    const mockBookingId = 'booking_123';
    const mockPaymentId = 'payment_123';
    const mockAdminId = 'admin_user';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    function buildBaseDispute(stripePaymentIntentId: string, stripeAccountId: string) {
        return {
            id: mockDisputeId,
            status: 'open',
            booking: {
                id: mockBookingId,
                status: 'dispute_pending',
                payment: {
                    id: mockPaymentId,
                    status: 'held',
                    amountGross: 10000,
                    platformFee: 2000,
                    refundedAmountCents: 0,
                    stripePaymentIntentId,
                },
                payout: null,
                professional: {
                    stripeAccountId,
                },
            },
        };
    }

    it('should handle FULL REFUND correctly', async () => {
        const captured = await createCapturedPaymentIntent(10_000);
        const connectedAccount = await createConnectedAccount();
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(
            buildBaseDispute(captured.paymentIntent.id, connectedAccount.id) as any
        );

        await resolveDispute(mockDisputeId, 'Refunded due to issue', 'full_refund', mockAdminId);

        const refunds = await stripeTest.refunds.list({
            payment_intent: captured.paymentIntent.id,
            limit: 1,
        });
        expect(refunds.data.length).toBeGreaterThan(0);
        expect(refunds.data[0].amount).toBe(10_000);

        expect(prisma.payment.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: mockPaymentId },
                data: expect.objectContaining({
                    status: 'refunded',
                    refundedAmountCents: 10000,
                }),
            })
        );

        expect(prisma.booking.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: mockBookingId },
                data: { status: 'refunded' },
            })
        );
    });

    it('should handle PARTIAL REFUND correctly', async () => {
        const captured = await createCapturedPaymentIntent(10_000);
        const connectedAccount = await createConnectedAccount();
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(
            buildBaseDispute(captured.paymentIntent.id, connectedAccount.id) as any
        );

        await resolveDispute(mockDisputeId, 'Partial refund', 'partial_refund', mockAdminId, 5000);

        const refunds = await stripeTest.refunds.list({
            payment_intent: captured.paymentIntent.id,
            limit: 1,
        });
        expect(refunds.data.length).toBeGreaterThan(0);
        expect(refunds.data[0].amount).toBe(5_000);

        expect(prisma.payment.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: mockPaymentId },
                data: expect.objectContaining({
                    status: 'partially_refunded',
                    refundedAmountCents: 5000,
                }),
            })
        );
    });

    it('should handle DISMISS (Payout to Pro) correctly', async () => {
        const captured = await createCapturedPaymentIntent(10_000);
        const connectedAccount = await createConnectedAccount();
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(
            buildBaseDispute(captured.paymentIntent.id, connectedAccount.id) as any
        );

        vi.mocked(prisma.payout.create).mockResolvedValue({
            id: 'payout_new',
            status: 'pending',
            amountNet: 8000,
            proStripeAccountId: connectedAccount.id,
        } as any);

        await resolveDispute(mockDisputeId, 'Dispute dismissed', 'dismiss', mockAdminId);

        const payoutUpdatePayload = vi.mocked(prisma.payout.update).mock.calls[0]?.[0] as any;
        expect(payoutUpdatePayload.data.status).toBe('paid');
        expect(typeof payoutUpdatePayload.data.stripeTransferId).toBe('string');
        expect(payoutUpdatePayload.data.stripeTransferId.startsWith('tr_')).toBe(true);

        const transfer = await stripeTest.transfers.retrieve(payoutUpdatePayload.data.stripeTransferId);
        expect(transfer.destination).toBe(connectedAccount.id);
        expect(transfer.source_transaction).toBe(captured.chargeId);
    });

    it('should throw if partial refund amount is missing', async () => {
        const captured = await createCapturedPaymentIntent(10_000);
        const connectedAccount = await createConnectedAccount();
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(
            buildBaseDispute(captured.paymentIntent.id, connectedAccount.id) as any
        );

        await expect(resolveDispute(mockDisputeId, 'bad', 'partial_refund', mockAdminId)).rejects.toThrow(
            'Partial refund requires a positive amount'
        );
    });

    it('should no-op when dispute is already resolved with matching outcome', async () => {
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue({
            id: mockDisputeId,
            status: 'resolved',
            booking: {
                id: mockBookingId,
                status: 'refunded',
                payment: {
                    id: mockPaymentId,
                    status: 'refunded',
                    amountGross: 10000,
                    platformFee: 2000,
                    refundedAmountCents: 10000,
                    stripePaymentIntentId: 'pi_test',
                },
                payout: null,
                professional: {
                    stripeAccountId: 'acct_test',
                },
            },
        } as any);

        const result = await resolveDispute(mockDisputeId, 'Retry', 'full_refund', mockAdminId);

        expect(result).toEqual({ success: true, alreadyResolved: true });
    });

    it('should throw TransitionConflictError when dispute is already resolved with different outcome', async () => {
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue({
            id: mockDisputeId,
            status: 'resolved',
            booking: {
                id: mockBookingId,
                status: 'completed',
                payment: {
                    id: mockPaymentId,
                    status: 'released',
                    amountGross: 10000,
                    platformFee: 2000,
                    refundedAmountCents: 0,
                    stripePaymentIntentId: 'pi_test',
                },
                payout: {
                    id: 'payout_1',
                    status: 'paid',
                },
                professional: {
                    stripeAccountId: 'acct_test',
                },
            },
        } as any);

        await expect(
            resolveDispute(mockDisputeId, 'Retry mismatch', 'full_refund', mockAdminId)
        ).rejects.toThrow(TransitionConflictError);
    });
});
