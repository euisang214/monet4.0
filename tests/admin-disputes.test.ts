import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDispute } from '@/lib/domain/admin/disputes';
import { prisma } from '@/lib/core/db';
import { createTransfer, refundPayment } from '@/lib/integrations/stripe';

// Mock Dependencies
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
        $transaction: vi.fn((callback) => callback), // Mock transaction to just return array of promises usually, but here we passed an array.
        // Wait, in my code I used prisma.$transaction([...promises]).
        // So the mock should just return the resolved array.
    },
}));

// Mock $transaction to return the inputs (simulating success)
vi.mocked(prisma.$transaction).mockImplementation(async (promises: any) => {
    return Promise.all(promises);
});


vi.mock('@/lib/integrations/stripe', () => ({
    createTransfer: vi.fn(),
    refundPayment: vi.fn(),
}));

describe('Admin Dispute Resolution', () => {

    const mockDisputeId = 'dispute_123';
    const mockBookingId = 'booking_123';
    const mockPaymentId = 'payment_123';
    const mockAdminId = 'admin_user';
    const mockStripeIntentId = 'pi_123';
    const mockProStripeId = 'acct_pro';

    const baseDispute = {
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
                stripePaymentIntentId: mockStripeIntentId,
            },
            payout: null,
            professional: {
                stripeAccountId: mockProStripeId
            }
        }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle FULL REFUND correctly', async () => {
        // Setup
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(baseDispute as any);
        vi.mocked(refundPayment).mockResolvedValue({ id: 're_123', amount: 10000 } as any);

        // Execute
        await resolveDispute(mockDisputeId, 'Refunded due to issue', 'full_refund', mockAdminId);

        // Verify Stripe Call
        expect(refundPayment).toHaveBeenCalledWith(mockStripeIntentId); // No amount = full

        // Verify DB Updates
        expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: mockPaymentId },
            data: expect.objectContaining({
                status: 'refunded',
                refundedAmountCents: 10000
            })
        }));

        expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: mockBookingId },
            data: { status: 'refunded' }
        }));

        expect(prisma.dispute.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: mockDisputeId },
            data: expect.objectContaining({
                status: 'resolved',
                resolution: 'Refunded due to issue'
            })
        }));

        expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should handle PARTIAL REFUND correctly', async () => {
        // Setup
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(baseDispute as any);
        vi.mocked(refundPayment).mockResolvedValue({ id: 're_partial', amount: 5000 } as any);

        // Execute
        await resolveDispute(mockDisputeId, 'Partial refund', 'partial_refund', mockAdminId, 5000);

        // Verify Stripe Call
        expect(refundPayment).toHaveBeenCalledWith(mockStripeIntentId, 5000);

        // Verify DB Updates
        expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: mockPaymentId },
            data: expect.objectContaining({
                status: 'partially_refunded',
                refundedAmountCents: 5000
            })
        }));

        // Booking status for partial refund => completed
        expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: mockBookingId },
            data: { status: 'completed' }
        }));
    });

    it('should handle DISMISS (Payout to Pro) correctly', async () => {
        // Setup
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(baseDispute as any);
        // Mock payout creation returning a pending payout
        vi.mocked(prisma.payout.create).mockResolvedValue({
            id: 'payout_new',
            status: 'pending',
            amountNet: 8000,
            proStripeAccountId: mockProStripeId
        } as any);
        vi.mocked(createTransfer).mockResolvedValue({ id: 'tr_123' } as any);

        // Execute
        await resolveDispute(mockDisputeId, 'Dispute dismissed', 'dismiss', mockAdminId);

        // Verify Stripe Transfer
        expect(createTransfer).toHaveBeenCalledWith(8000, mockProStripeId, mockBookingId, expect.any(Object));

        // Verify Payout Creation & Update
        expect(prisma.payout.create).toHaveBeenCalled(); // Because it didn't exist in baseDispute
        expect(prisma.payout.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'payout_new' },
            data: expect.objectContaining({ status: 'paid' })
        }));

        // Verify Payment/Booking Updates
        expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'released' })
        }));
        expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
            data: { status: 'completed' }
        }));
    });

    it('should throw if partial refund amount is missing', async () => {
        vi.mocked(prisma.dispute.findUnique).mockResolvedValue(baseDispute as any);
        await expect(resolveDispute(mockDisputeId, 'bad', 'partial_refund', mockAdminId))
            .rejects.toThrow('Partial refund requires a positive amount');
    });

});
