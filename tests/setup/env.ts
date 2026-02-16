import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

const required = ['STRIPE_TEST_SECRET_KEY', 'STRIPE_TEST_WEBHOOK_SECRET'];
const missing = required.filter((key) => !process.env[key] || process.env[key]?.trim().length === 0);

if (missing.length > 0) {
    throw new Error(
        `[tests/setup/env] Missing required Stripe test environment variables: ${missing.join(', ')}`
    );
}

process.env.STRIPE_SECRET_KEY = process.env.STRIPE_TEST_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_TEST_WEBHOOK_SECRET;
