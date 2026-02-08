import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is missing');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    // apiVersion: '2025-01-27.acacia', // Using SDK default
    typescript: true,
});

/**
 * Returns true for stale/invalid Connect account IDs that should trigger recovery.
 */
export function isMissingOrInvalidConnectAccountError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const stripeError = error as { code?: unknown };
    return stripeError.code === 'account_invalid' || stripeError.code === 'resource_missing';
}

/**
 * Creates a PaymentIntent with manual capture for the "Separate Charges and Transfers" flow.
 * Funds are authorized but not captured until the professional accepts.
 */
export async function createPaymentIntent(
    amountCents: number,
    customerId?: string,
    metadata?: Record<string, string>
) {
    return stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        capture_method: 'manual', // CRITICAL: Holds funds until manual capture
        customer: customerId,
        metadata,
        setup_future_usage: 'off_session',
    });
}

/**
 * Captures a previously authorized PaymentIntent.
 * Call this when the professional accepts the booking.
 */
export async function capturePayment(paymentIntentId: string) {
    return stripe.paymentIntents.capture(paymentIntentId);
}

/**
 * Cancels a PaymentIntent using the Stripe API.
 * This releases the manual hold on the customer's card.
 */
export async function cancelPaymentIntent(paymentIntentId: string) {
    return stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Creates a transfer to a connected account.
 * Call this after QC passes to release funds to the professional.
 */
export async function createTransfer(
    amountCents: number,
    destinationAccountId: string,
    transferGroup: string,
    metadata?: Record<string, string>
) {
    return stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: destinationAccountId,
        transfer_group: transferGroup,
        metadata,
    });
}

/**
 * Refunds a payment, optionally partial.
 * If amountCents is not provided, refunds the full amount.
 */
export async function refundPayment(
    paymentIntentId: string,
    amountCents?: number,
    reason?: Stripe.RefundCreateParams.Reason
) {
    return stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents,
        reason,
    });
}

/**
 * Creates a Stripe Customer.
 * Used for Candidates to save payment methods.
 */
export async function createCustomer(email: string, name?: string) {
    return stripe.customers.create({
        email,
        name,
    });
}

/**
 * Creates a Stripe Connect Account (Express).
 * Used for Professionals to receive payouts.
 */
export async function createConnectAccount(email: string) {
    return stripe.accounts.create({
        type: 'express', // Platform controls flow, Stripe handles KYC
        email,
        capabilities: {
            transfers: { requested: true },
        },
    });
}

/**
 * Creates an Account Link for onboarding.
 * Redirects user to Stripe's hosted onboarding flow.
 */
export async function createAccountLink(accountId: string, returnUrl: string, refreshUrl: string) {
    return stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
    });
}

/**
 * Retrieves a Stripe Account.
 * Used to check details_submitted status.
 */
export async function retrieveAccount(accountId: string) {
    return stripe.accounts.retrieve(accountId);
}

/**
 * Constructs a webhook event from signature.
 * Securely verifies the event came from Stripe.
 */
export async function constructEvent(body: string | Buffer, signature: string, secret: string) {
    return stripe.webhooks.constructEvent(body, signature, secret);
}

/**
 * Retrieves a Balance Transaction to get fee details.
 * Used for precise net amount calculation.
 */
export async function retrieveBalanceTransaction(transactionId: string) {
    return stripe.balanceTransactions.retrieve(transactionId);
}
