
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QCService } from '@/lib/domain/qc/services';
import { prisma } from '@/lib/core/db';
import { qcQueue, notificationsQueue } from '@/lib/queues';
import { stripe } from '@/lib/integrations/stripe';
import { BookingStatus, QCStatus } from '@prisma/client';

// Mock Dependencies
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

vi.mock('@/lib/integrations/stripe', () => ({
    stripe: {
        paymentIntents: {
            retrieve: vi.fn(),
        },
    },
    createTransfer: vi.fn(),
    refundPayment: vi.fn(),
    retrieveBalanceTransaction: vi.fn(),
}));

vi.mock('@/lib/integrations/claude', () => ({
    ClaudeService: {
        validateFeedback: vi.fn(),
    },
}));

// Need to mock shared helper or it will run real code
vi.mock('@/lib/shared/qc', () => ({
    validateFeedbackRequirements: vi.fn().mockReturnValue({ passed: true, reasons: [] }),
}));

describe('QC Timeout Logic', () => {
    const mockBookingId = 'booking_abc';
    const mockPiId = 'pi_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Scheduling', () => {
        it('should schedule timeout and nudges when QC returns revise', async () => {
            // Mock Data
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                feedback: { text: 'content', actions: [] },
                professional: {},
            } as any);

            // Mock Claude Reject
            const { ClaudeService } = await import('@/lib/integrations/claude');
            vi.mocked(ClaudeService.validateFeedback).mockResolvedValue({
                passed: false,
                reasons: ['revise_please']
            });

            // Execute
            await QCService.processQCJob(mockBookingId);

            // Verify Timeout Job
            expect(qcQueue.add).toHaveBeenCalledWith(
                'qc-timeout',
                { bookingId: mockBookingId },
                expect.objectContaining({ delay: 7 * 24 * 60 * 60 * 1000 })
            );

            // Verify Nudges (at least one)
            expect(notificationsQueue.add).toHaveBeenCalledWith(
                'send-email',
                expect.objectContaining({ type: 'feedback_revise_nudge' }),
                expect.objectContaining({ delay: 24 * 60 * 60 * 1000 })
            );
        });
    });

    describe('Timeout Execution', () => {
        it('should calculate 50% net and process refund/transfer', async () => {
            // Mock Data
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                status: BookingStatus.accepted, // or passed pending qc?
                payment: {
                    stripePaymentIntentId: mockPiId,
                    amountGross: 10000, // $100
                },
                professional: {
                    stripeAccountId: 'acct_pro'
                }
            } as any);

            vi.mocked(prisma.callFeedback.findUnique).mockResolvedValue({
                qcStatus: QCStatus.revise
            } as any);

            // Mock Stripe Fee Fetch
            vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({
                latest_charge: {
                    balance_transaction: {
                        fee: 300 // $3.00 fee
                    }
                }
            } as any);

            // Execute
            await QCService.handleTimeout(mockBookingId);

            // Verify Logic
            // Net = 10000 - 300 = 9700
            // Share = 4850

            const { refundPayment, createTransfer } = await import('@/lib/integrations/stripe');

            expect(refundPayment).toHaveBeenCalledWith(mockPiId, 4850, 'requested_by_customer');
            expect(createTransfer).toHaveBeenCalledWith(4850, 'acct_pro', mockBookingId, expect.any(Object));

            expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: mockBookingId },
                data: { status: BookingStatus.completed }
            }));
        });

        it('should estimate fee if stripe fetch fails', async () => {
            // Mock Data
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                payment: {
                    stripePaymentIntentId: mockPiId,
                    amountGross: 10000, // $100
                },
                professional: { stripeAccountId: 'acct_pro' }
            } as any);

            vi.mocked(prisma.callFeedback.findUnique).mockResolvedValue({ qcStatus: QCStatus.revise } as any);

            // Mock Stripe Error
            vi.mocked(stripe.paymentIntents.retrieve).mockRejectedValue(new Error('Stripe API Error'));

            // Execute
            await QCService.handleTimeout(mockBookingId);

            // Verify Logic
            // Est Fee = 10000 * 0.029 + 30 = 290 + 30 = 320
            // Net = 9680
            // Share = 4840

            const { refundPayment } = await import('@/lib/integrations/stripe');
            expect(refundPayment).toHaveBeenCalledWith(mockPiId, 4840, 'requested_by_customer');
        });
    });
});
