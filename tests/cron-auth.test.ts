import { afterEach, describe, expect, it } from 'vitest';
import { requireCronAuth } from '@/lib/core/cron-auth';

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (typeof ORIGINAL_CRON_SECRET === 'undefined') {
        delete process.env.CRON_SECRET;
    } else {
        process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
    }
});

describe('requireCronAuth', () => {
    it('authorizes bearer token when CRON_SECRET is configured', () => {
        process.env.NODE_ENV = 'production';
        process.env.CRON_SECRET = 'topsecret';

        const request = new Request('http://localhost/api/internal/cron/bookings/expiry', {
            headers: {
                authorization: 'Bearer topsecret',
            },
        });

        const result = requireCronAuth(request);
        expect(result).toBeNull();
    });

    it('rejects invalid bearer token when CRON_SECRET is configured', async () => {
        process.env.NODE_ENV = 'production';
        process.env.CRON_SECRET = 'topsecret';

        const request = new Request('http://localhost/api/internal/cron/bookings/expiry', {
            headers: {
                authorization: 'Bearer wrong',
            },
        });

        const result = requireCronAuth(request);
        expect(result?.status).toBe(401);
        await expect(result?.json()).resolves.toEqual({ error: 'unauthorized' });
    });

    it('allows requests without a secret in non-production', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.CRON_SECRET;

        const request = new Request('http://localhost/api/internal/cron/bookings/expiry');

        const result = requireCronAuth(request);
        expect(result).toBeNull();
    });

    it('allows vercel cron headers without a secret in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.CRON_SECRET;

        const request = new Request('http://localhost/api/internal/cron/bookings/expiry', {
            headers: {
                'x-vercel-cron': '1',
            },
        });

        const result = requireCronAuth(request);
        expect(result).toBeNull();
    });

    it('rejects production requests without secret or vercel cron headers', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.CRON_SECRET;

        const request = new Request('http://localhost/api/internal/cron/bookings/expiry');

        const result = requireCronAuth(request);
        expect(result?.status).toBe(401);
        await expect(result?.json()).resolves.toEqual({ error: 'unauthorized' });
    });
});
