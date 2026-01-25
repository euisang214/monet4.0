import { vi } from 'vitest';

/**
 * Mock implementation of the Stripe SDK
 * Exports a `mockStripe` object that can be used to spy on calls and return values.
 */
export const mockStripe = {
    paymentIntents: {
        create: vi.fn(),
        capture: vi.fn(),
        update: vi.fn(),
    },
    transfers: {
        create: vi.fn(),
    },
    refunds: {
        create: vi.fn(),
    },
    customers: {
        create: vi.fn(),
    },
    accounts: {
        create: vi.fn(),
        retrieve: vi.fn(),
    },
    accountLinks: {
        create: vi.fn(),
    },
    webhooks: {
        constructEvent: vi.fn(),
    },
};
