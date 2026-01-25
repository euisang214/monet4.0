import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QCService } from '@/lib/domain/qc/services';
import { PaymentsService } from '@/lib/domain/payments/services';
import { prisma } from '@/lib/core/db';
import { paymentsQueue } from '@/lib/queues';
import { createTransfer } from '@/lib/integrations/stripe';

// Mock Dependencies
vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: { findUnique: vi.fn() },
        callFeedback: { update: vi.fn() },
        payout: {
            upsert: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn()
        },
    },
}));

vi.mock('@/lib/integrations/stripe', () => ({
    createTransfer: vi.fn(),
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
    const mockProId = 'pro_123';
    const mockStripeAccountId = 'acct_123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('QC Service', () => {
        it('should fail validation if word count is too low', async () => {
            // Setup
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                feedback: {
                    text: 'Too short',
                    actions: ['Action 1', 'Action 2', 'Action 3'],
                },
                professional: { stripeAccountId: mockStripeAccountId },
            } as any);

            // Execute
            await QCService.processQCJob(mockBookingId);

            // Verify
            expect(prisma.callFeedback.update).toHaveBeenCalledWith({
                where: { bookingId: mockBookingId },
                data: { qcStatus: 'revise' },
            });
            // Should NOT create payout
            expect(prisma.payout.upsert).not.toHaveBeenCalled();
        });

        it('should pass if valid and enqueue payment', async () => {
            // Setup
            const longText = 'word '.repeat(201);
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                priceCents: 10000,
                feedback: {
                    text: longText,
                    actions: ['Action 1', 'Action 2', 'Action 3'],
                },
                professional: { stripeAccountId: mockStripeAccountId },
            } as any);

            // Mock Claude Pass
            const { ClaudeService } = await import('@/lib/integrations/claude');
            vi.mocked(ClaudeService.validateFeedback).mockResolvedValue({
                passed: true,
                reasons: []
            });

            vi.mocked(prisma.payout.upsert).mockResolvedValue({
                status: 'pending'
            } as any);

            // Execute
            await QCService.processQCJob(mockBookingId);

            // Verify
            expect(prisma.callFeedback.update).toHaveBeenCalledWith({
                where: { bookingId: mockBookingId },
                data: { qcStatus: 'passed' },
            });

            expect(prisma.payout.upsert).toHaveBeenCalledWith(expect.objectContaining({
                where: { bookingId: mockBookingId },
                create: expect.objectContaining({
                    amountNet: 8000, // 80% of 10000
                    status: 'pending'
                })
            }));

            expect(paymentsQueue.add).toHaveBeenCalledWith('process-payout', { bookingId: mockBookingId });
        });

        it('should fail if Claude rejects quality', async () => {
            // Setup
            const longText = 'word '.repeat(201); // Valid length
            vi.mocked(prisma.booking.findUnique).mockResolvedValue({
                id: mockBookingId,
                feedback: {
                    text: longText,
                    actions: ['Action 1', 'Action 2', 'Action 3'],
                },
                professional: { stripeAccountId: mockStripeAccountId },
            } as any);

            // Mock Claude Reject
            const { ClaudeService } = await import('@/lib/integrations/claude');
            vi.mocked(ClaudeService.validateFeedback).mockResolvedValue({
                passed: false,
                reasons: ['Content is repetitive']
            });

            // Execute
            await QCService.processQCJob(mockBookingId);

            // Verify
            expect(prisma.callFeedback.update).not.toHaveBeenCalledWith(expect.objectContaining({
                data: { qcStatus: 'passed' }
            }));
            // Should have sent email
            const { notificationsQueue } = await import('@/lib/queues');
            expect(notificationsQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
                type: 'feedback_revise',
                reasons: ['Content is repetitive']
            }));
        });
    });

    describe('Payments Service', () => {
        it('should be idempotent (skip if already paid)', async () => {
            // Setup
            vi.mocked(prisma.payout.findUnique).mockResolvedValue({
                id: 'payout_123',
                status: 'paid',
                booking: {},
            } as any);

            // Execute
            const result = await PaymentsService.processPayoutJob(mockBookingId);

            // Verify
            expect(createTransfer).not.toHaveBeenCalled();
            expect(result.status).toBe('already_paid');
        });

        it('should execute transfer if pending', async () => {
            // Setup
            vi.mocked(prisma.payout.findUnique).mockResolvedValue({
                id: 'payout_123',
                status: 'pending',
                amountNet: 8000,
                proStripeAccountId: mockStripeAccountId,
                booking: {},
            } as any);

            vi.mocked(createTransfer).mockResolvedValue({ id: 'tr_123' } as any);

            // Execute
            await PaymentsService.processPayoutJob(mockBookingId);

            // Verify
            expect(createTransfer).toHaveBeenCalledWith(8000, mockStripeAccountId, mockBookingId, expect.any(Object));
            expect(prisma.payout.update).toHaveBeenCalledWith({
                where: { id: 'payout_123' },
                data: expect.objectContaining({
                    status: 'paid',
                    stripeTransferId: 'tr_123',
                })
            });
        });
    });

});
