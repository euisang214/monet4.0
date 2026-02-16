import { describe, it, expect } from 'vitest';
import Stripe from 'stripe';
import {
    createPaymentIntent,
    capturePayment,
    cancelPaymentIntent,
    createTransfer,
    refundPayment,
    createCustomer,
    createConnectAccount,
    createAccountLink,
    retrieveAccount,
    constructEvent,
    retrieveBalanceTransaction,
} from '@/lib/integrations/stripe';
import {
    stripeTest,
    createConnectedAccount,
    createManualCapturePaymentIntentConfirmed,
    createCapturedPaymentIntent,
} from './helpers/stripe-live';

describe('Stripe Integration (Live Test Mode)', () => {
    describe('Payment Intents', () => {
        it('createPaymentIntent should create a real PaymentIntent', async () => {
            const paymentIntent = await createPaymentIntent(10_000, undefined, { bookingId: 'live-pi-create' });
            expect(paymentIntent.id.startsWith('pi_')).toBe(true);
            expect(paymentIntent.amount).toBe(10_000);
            expect(paymentIntent.capture_method).toBe('manual');
        });

        it('capturePayment should capture a requires_capture PaymentIntent', async () => {
            const paymentIntent = await createManualCapturePaymentIntentConfirmed(10_000, { bookingId: 'live-capture' });
            expect(paymentIntent.status).toBe('requires_capture');

            const captured = await capturePayment(paymentIntent.id);
            expect(captured.status).toBe('succeeded');
        });

        it('cancelPaymentIntent should cancel an uncaptured PaymentIntent', async () => {
            const paymentIntent = await createManualCapturePaymentIntentConfirmed(10_000, { bookingId: 'live-cancel' });
            const canceled = await cancelPaymentIntent(paymentIntent.id);
            expect(canceled.status).toBe('canceled');
        });
    });

    describe('Refunds', () => {
        it('refundPayment should create full refund when no amount specified', async () => {
            const captured = await createCapturedPaymentIntent(10_000);
            const refund = await refundPayment(captured.paymentIntent.id);
            expect(refund.id.startsWith('re_')).toBe(true);
            expect(refund.status).toBe('succeeded');
            expect(refund.amount).toBe(10_000);
        });

        it('refundPayment should create partial refund with specified amount', async () => {
            const captured = await createCapturedPaymentIntent(10_000);
            const refund = await refundPayment(captured.paymentIntent.id, 5_000, 'requested_by_customer');
            expect(refund.status).toBe('succeeded');
            expect(refund.amount).toBe(5_000);
        });
    });

    describe('Transfers', () => {
        it('createTransfer should transfer to a connected account from a source transaction', async () => {
            const account = await createConnectedAccount();
            const captured = await createCapturedPaymentIntent(10_000);
            const transfer = await createTransfer(
                8_000,
                account.id,
                `booking-${Date.now()}`,
                { type: 'payout' },
                captured.chargeId
            );
            expect(transfer.id.startsWith('tr_')).toBe(true);
            expect(transfer.amount).toBe(8_000);
            expect(transfer.destination).toBe(account.id);
            expect(transfer.source_transaction).toBe(captured.chargeId);
        });
    });

    describe('Customers', () => {
        it('createCustomer should create a Stripe customer', async () => {
            const customer = await createCustomer(`live-${Date.now()}@example.com`, 'Live Test User');
            expect(customer.id.startsWith('cus_')).toBe(true);
            expect(customer.email).toContain('@example.com');
        });
    });

    describe('Connect Accounts', () => {
        it('createConnectAccount should create Express account', async () => {
            const account = await createConnectAccount(`pro-${Date.now()}@example.com`);
            expect(account.id.startsWith('acct_')).toBe(true);
            expect(account.type).toBe('express');
        });

        it('createAccountLink should generate onboarding link', async () => {
            const account = await createConnectAccount(`pro-link-${Date.now()}@example.com`);
            const result = await createAccountLink(
                account.id,
                'https://example.com/return',
                'https://example.com/refresh'
            );
            expect(result.url).toContain('stripe.com');
        });

        it('retrieveAccount should fetch account details', async () => {
            const account = await createConnectAccount(`pro-retrieve-${Date.now()}@example.com`);
            const fetched = await retrieveAccount(account.id);
            expect(fetched.id).toBe(account.id);
        });
    });

    describe('Webhooks', () => {
        it('constructEvent should verify and parse webhook payload', async () => {
            const payload = JSON.stringify({
                id: `evt_${Date.now()}`,
                object: 'event',
                type: 'payment_intent.succeeded',
                data: { object: { id: `pi_${Date.now()}` } },
            });
            const signature = stripeTest.webhooks.generateTestHeaderString({
                payload,
                secret: process.env.STRIPE_TEST_WEBHOOK_SECRET!,
            });

            const event = await constructEvent(payload, signature, process.env.STRIPE_TEST_WEBHOOK_SECRET!);
            expect(event.type).toBe('payment_intent.succeeded');
        });

        it('constructEvent should throw on invalid signature', async () => {
            await expect(
                constructEvent(
                    '{"type":"payment_intent.succeeded"}',
                    'invalid_sig',
                    process.env.STRIPE_TEST_WEBHOOK_SECRET!
                )
            ).rejects.toThrow();
        });
    });

    describe('Balance Transactions', () => {
        it('retrieveBalanceTransaction should fetch fee details', async () => {
            const captured = await createCapturedPaymentIntent(10_000);
            const paymentIntent = await stripeTest.paymentIntents.retrieve(captured.paymentIntent.id, {
                expand: ['latest_charge.balance_transaction'],
            });

            const latestCharge = paymentIntent.latest_charge as Stripe.Charge;
            const balanceTransaction = latestCharge.balance_transaction as Stripe.BalanceTransaction;

            const txn = await retrieveBalanceTransaction(balanceTransaction.id);
            expect(txn.id).toBe(balanceTransaction.id);
            expect(txn.fee).toBeGreaterThanOrEqual(0);
        });
    });
});
