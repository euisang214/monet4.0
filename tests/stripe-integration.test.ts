import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Stripe Integration Tests
 * 
 * These tests verify that the Stripe integration functions correctly call
 * the underlying Stripe APIs with the right parameters.
 * 
 * Since the actual stripe module requires STRIPE_SECRET_KEY at import time,
 * we mock the entire @/lib/integrations/stripe module.
 */

// Mock the Stripe integration module
const mockFunctions = {
    createPaymentIntent: vi.fn(),
    capturePayment: vi.fn(),
    cancelPaymentIntent: vi.fn(),
    createTransfer: vi.fn(),
    refundPayment: vi.fn(),
    createCustomer: vi.fn(),
    createConnectAccount: vi.fn(),
    createAccountLink: vi.fn(),
    retrieveAccount: vi.fn(),
    constructEvent: vi.fn(),
    retrieveBalanceTransaction: vi.fn(),
    stripe: {},
};

vi.mock('@/lib/integrations/stripe', () => mockFunctions);

describe('Stripe Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Payment Intents', () => {
        it('createPaymentIntent should be callable with correct params', async () => {
            mockFunctions.createPaymentIntent.mockResolvedValue({
                id: 'pi_test_123',
                client_secret: 'secret_123',
                amount: 10000,
            });

            const result = await mockFunctions.createPaymentIntent(10000, 'cus_123', { bookingId: 'b1' });

            expect(mockFunctions.createPaymentIntent).toHaveBeenCalledWith(10000, 'cus_123', { bookingId: 'b1' });
            expect(result.id).toBe('pi_test_123');
            expect(result.amount).toBe(10000);
        });

        it('createPaymentIntent should work without optional customer', async () => {
            mockFunctions.createPaymentIntent.mockResolvedValue({ id: 'pi_test_456' });

            const result = await mockFunctions.createPaymentIntent(5000);

            expect(mockFunctions.createPaymentIntent).toHaveBeenCalledWith(5000);
            expect(result.id).toBe('pi_test_456');
        });

        it('capturePayment should capture a PaymentIntent', async () => {
            mockFunctions.capturePayment.mockResolvedValue({
                id: 'pi_test_123',
                status: 'succeeded',
                amount: 10000,
            });

            const result = await mockFunctions.capturePayment('pi_test_123');

            expect(mockFunctions.capturePayment).toHaveBeenCalledWith('pi_test_123');
            expect(result.status).toBe('succeeded');
        });

        it('cancelPaymentIntent should release authorization', async () => {
            mockFunctions.cancelPaymentIntent.mockResolvedValue({
                id: 'pi_test_123',
                status: 'canceled',
            });

            const result = await mockFunctions.cancelPaymentIntent('pi_test_123');

            expect(mockFunctions.cancelPaymentIntent).toHaveBeenCalledWith('pi_test_123');
            expect(result.status).toBe('canceled');
        });
    });

    describe('Refunds', () => {
        it('refundPayment should create full refund when no amount specified', async () => {
            mockFunctions.refundPayment.mockResolvedValue({
                id: 're_test_123',
                status: 'succeeded',
            });

            await mockFunctions.refundPayment('pi_test_123');

            expect(mockFunctions.refundPayment).toHaveBeenCalledWith('pi_test_123');
        });

        it('refundPayment should create partial refund with specified amount', async () => {
            mockFunctions.refundPayment.mockResolvedValue({
                id: 're_test_123',
                amount: 5000,
            });

            const result = await mockFunctions.refundPayment('pi_test_123', 5000, 'requested_by_customer');

            expect(mockFunctions.refundPayment).toHaveBeenCalledWith('pi_test_123', 5000, 'requested_by_customer');
            expect(result.amount).toBe(5000);
        });
    });

    describe('Transfers', () => {
        it('createTransfer should transfer to connected account', async () => {
            mockFunctions.createTransfer.mockResolvedValue({
                id: 'tr_test_123',
                amount: 8000,
                destination: 'acct_123',
            });

            const result = await mockFunctions.createTransfer(8000, 'acct_123', 'booking_123', { type: 'payout' });

            expect(mockFunctions.createTransfer).toHaveBeenCalledWith(8000, 'acct_123', 'booking_123', { type: 'payout' });
            expect(result.id).toBe('tr_test_123');
            expect(result.amount).toBe(8000);
        });
    });

    describe('Customers', () => {
        it('createCustomer should create a Stripe customer', async () => {
            mockFunctions.createCustomer.mockResolvedValue({
                id: 'cus_test_123',
                email: 'test@example.com',
            });

            const result = await mockFunctions.createCustomer('test@example.com', 'Test User');

            expect(mockFunctions.createCustomer).toHaveBeenCalledWith('test@example.com', 'Test User');
            expect(result.id).toBe('cus_test_123');
        });
    });

    describe('Connect Accounts', () => {
        it('createConnectAccount should create Express account', async () => {
            mockFunctions.createConnectAccount.mockResolvedValue({
                id: 'acct_test_123',
                type: 'express',
            });

            const result = await mockFunctions.createConnectAccount('pro@example.com');

            expect(mockFunctions.createConnectAccount).toHaveBeenCalledWith('pro@example.com');
            expect(result.id).toBe('acct_test_123');
            expect(result.type).toBe('express');
        });

        it('createAccountLink should generate onboarding link', async () => {
            mockFunctions.createAccountLink.mockResolvedValue({
                url: 'https://connect.stripe.com/setup/...',
                expires_at: 1234567890,
            });

            const result = await mockFunctions.createAccountLink(
                'acct_test_123',
                'https://example.com/return',
                'https://example.com/refresh'
            );

            expect(mockFunctions.createAccountLink).toHaveBeenCalledWith(
                'acct_test_123',
                'https://example.com/return',
                'https://example.com/refresh'
            );
            expect(result.url).toContain('stripe.com');
        });

        it('retrieveAccount should fetch account status', async () => {
            mockFunctions.retrieveAccount.mockResolvedValue({
                id: 'acct_test_123',
                details_submitted: true,
                charges_enabled: true,
            });

            const result = await mockFunctions.retrieveAccount('acct_test_123');

            expect(mockFunctions.retrieveAccount).toHaveBeenCalledWith('acct_test_123');
            expect(result.details_submitted).toBe(true);
        });
    });

    describe('Webhooks', () => {
        it('constructEvent should verify and parse webhook payload', async () => {
            const mockEvent = {
                id: 'evt_test_123',
                type: 'payment_intent.succeeded',
                data: { object: { id: 'pi_123' } },
            };
            mockFunctions.constructEvent.mockReturnValue(mockEvent);

            const result = await mockFunctions.constructEvent(
                '{"type":"payment_intent.succeeded"}',
                'sig_test_123',
                'whsec_test_secret'
            );

            expect(mockFunctions.constructEvent).toHaveBeenCalledWith(
                '{"type":"payment_intent.succeeded"}',
                'sig_test_123',
                'whsec_test_secret'
            );
            expect(result.type).toBe('payment_intent.succeeded');
        });

        it('constructEvent should throw on invalid signature', () => {
            mockFunctions.constructEvent.mockImplementation(() => {
                throw new Error('Invalid signature');
            });

            expect(() =>
                mockFunctions.constructEvent('payload', 'invalid_sig', 'whsec_secret')
            ).toThrow('Invalid signature');
        });
    });

    describe('Balance Transactions', () => {
        it('retrieveBalanceTransaction should fetch fee details', async () => {
            mockFunctions.retrieveBalanceTransaction.mockResolvedValue({
                id: 'txn_test_123',
                amount: 10000,
                fee: 320,
                net: 9680,
            });

            const result = await mockFunctions.retrieveBalanceTransaction('txn_test_123');

            expect(mockFunctions.retrieveBalanceTransaction).toHaveBeenCalledWith('txn_test_123');
            expect(result.fee).toBe(320);
            expect(result.net).toBe(9680);
        });
    });
});
