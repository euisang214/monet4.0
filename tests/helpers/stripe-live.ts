import Stripe from 'stripe';

const secretKey = process.env.STRIPE_TEST_SECRET_KEY;
if (!secretKey) {
    throw new Error('Missing STRIPE_TEST_SECRET_KEY for live Stripe tests');
}

export const stripeTest = new Stripe(secretKey, {
    typescript: true,
});

const DEFAULT_TEST_PAYMENT_METHOD = process.env.STRIPE_TEST_DEFAULT_PAYMENT_METHOD || 'pm_card_visa';
const DEFAULT_TEST_RETURN_URL = process.env.STRIPE_TEST_RETURN_URL || 'https://example.com/stripe-return';
const TEST_CONNECTED_ACCOUNT_ID = process.env.STRIPE_TEST_CONNECTED_ACCOUNT_ID;
const CONNECT_ACCOUNT_WAIT_MS = 500;
const CONNECT_ACCOUNT_MAX_ATTEMPTS = 8;

function randomToken(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCapability(account: Stripe.Account, capability: string): string | null | undefined {
    const capabilities = account.capabilities as Record<string, string | null> | null | undefined;
    return capabilities?.[capability];
}

function hasTransferCapability(account: Stripe.Account): boolean {
    return ['transfers', 'crypto_transfers', 'legacy_payments'].some(
        (capability) => getCapability(account, capability) === 'active'
    );
}

function accountCapabilitySummary(account: Stripe.Account) {
    return {
        transfers: getCapability(account, 'transfers') ?? null,
        crypto_transfers: getCapability(account, 'crypto_transfers') ?? null,
        legacy_payments: getCapability(account, 'legacy_payments') ?? null,
        requirements_due: account.requirements?.currently_due ?? [],
        requirements_past_due: account.requirements?.past_due ?? [],
        disabled_reason: account.requirements?.disabled_reason ?? null,
    };
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTransferReady(accountId: string): Promise<Stripe.Account> {
    let latest = await stripeTest.accounts.retrieve(accountId);

    for (let attempt = 0; attempt < CONNECT_ACCOUNT_MAX_ATTEMPTS; attempt += 1) {
        if (hasTransferCapability(latest)) {
            return latest;
        }

        await wait(CONNECT_ACCOUNT_WAIT_MS);
        latest = await stripeTest.accounts.retrieve(accountId);
    }

    throw new Error(
        `Connected account ${accountId} is not transfer-ready: ${JSON.stringify(accountCapabilitySummary(latest))}`
    );
}

async function createCustomTransfersAccount(email: string): Promise<Stripe.Account> {
    return stripeTest.accounts.create({
        type: 'custom',
        country: 'US',
        email,
        business_type: 'individual',
        capabilities: {
            transfers: { requested: true },
        },
        external_account: 'btok_us_verified',
        business_profile: {
            mcc: '7399',
            product_description: 'Consulting services',
            // Stripe rejects placeholder/blocked domains (for example example.com, stripe.com).
            url: 'https://monetgemini.com',
        },
        individual: {
            first_name: 'Test',
            last_name: 'Account',
            email,
            dob: {
                day: 1,
                month: 1,
                year: 1990,
            },
            address: {
                line1: '510 Townsend St',
                city: 'San Francisco',
                state: 'CA',
                postal_code: '94103',
                country: 'US',
            },
            phone: '4155550000',
            ssn_last_4: '0000',
        },
        tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: '127.0.0.1',
            service_agreement: 'full',
        },
        metadata: {
            testRun: randomToken('run'),
        },
    });
}

async function createRecipientAccount(email: string): Promise<Stripe.Account> {
    return stripeTest.accounts.create({
        type: 'custom',
        country: 'US',
        email,
        business_type: 'individual',
        external_account: 'btok_us_verified',
        individual: {
            first_name: 'Test',
            last_name: 'Recipient',
            email,
            dob: {
                day: 1,
                month: 1,
                year: 1990,
            },
            address: {
                line1: '510 Townsend St',
                city: 'San Francisco',
                state: 'CA',
                postal_code: '94103',
                country: 'US',
            },
            phone: '4155550001',
            ssn_last_4: '0000',
        },
        tos_acceptance: {
            date: Math.floor(Date.now() / 1000),
            ip: '127.0.0.1',
            service_agreement: 'recipient',
        },
        metadata: {
            testRun: randomToken('run'),
            accountType: 'recipient',
        },
    });
}

export async function createConnectedAccount(): Promise<Stripe.Account> {
    if (TEST_CONNECTED_ACCOUNT_ID) {
        return waitForTransferReady(TEST_CONNECTED_ACCOUNT_ID);
    }

    const primary = await createCustomTransfersAccount(`${randomToken('acct')}@monet.local`);
    if (hasTransferCapability(primary)) {
        return primary;
    }

    try {
        return await waitForTransferReady(primary.id);
    } catch {
        const fallback = await createRecipientAccount(`${randomToken('acct-recipient')}@monet.local`);
        if (hasTransferCapability(fallback)) {
            return fallback;
        }
        return waitForTransferReady(fallback.id);
    }
}

export async function createManualCapturePaymentIntentConfirmed(
    amountCents = 10_000,
    metadata: Record<string, string> = {}
): Promise<Stripe.PaymentIntent> {
    return stripeTest.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        capture_method: 'manual',
        confirm: true,
        payment_method: DEFAULT_TEST_PAYMENT_METHOD,
        payment_method_types: ['card'],
        metadata: {
            ...metadata,
            testRun: randomToken('run'),
        },
    });
}

export async function confirmPaymentIntentForCapture(
    paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
    return stripeTest.paymentIntents.confirm(paymentIntentId, {
        payment_method: DEFAULT_TEST_PAYMENT_METHOD,
        return_url: DEFAULT_TEST_RETURN_URL,
    });
}

export async function capturePaymentIntentWithChargeDetails(paymentIntentId: string): Promise<{
    paymentIntent: Stripe.PaymentIntent;
    chargeId: string;
    balanceTransactionId: string | null;
}> {
    await stripeTest.paymentIntents.capture(paymentIntentId);
    const hydrated = await stripeTest.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge.balance_transaction'],
    });

    if (!hydrated.latest_charge || typeof hydrated.latest_charge === 'string') {
        throw new Error(`PaymentIntent ${paymentIntentId} does not have an expanded latest charge`);
    }

    const latestCharge = hydrated.latest_charge;
    const balanceTransactionId =
        typeof latestCharge.balance_transaction === 'string'
            ? latestCharge.balance_transaction
            : latestCharge.balance_transaction?.id || null;

    return {
        paymentIntent: hydrated,
        chargeId: latestCharge.id,
        balanceTransactionId,
    };
}

export async function createCapturedPaymentIntent(amountCents = 10_000): Promise<{
    paymentIntent: Stripe.PaymentIntent;
    chargeId: string;
    balanceTransactionId: string | null;
}> {
    const paymentIntent = await createManualCapturePaymentIntentConfirmed(amountCents);
    return capturePaymentIntentWithChargeDetails(paymentIntent.id);
}
