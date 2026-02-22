import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireCronAuthMock = vi.hoisted(() => vi.fn());
const processExpiryCheckMock = vi.hoisted(() => vi.fn());
const processNoShowCheckMock = vi.hoisted(() => vi.fn());
const processZoomAttendanceRetentionMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/core/cron-auth', () => ({
    requireCronAuth: requireCronAuthMock,
}));

vi.mock('@/lib/queues/bookings', () => ({
    processExpiryCheck: processExpiryCheckMock,
    processNoShowCheck: processNoShowCheckMock,
    processZoomAttendanceRetention: processZoomAttendanceRetentionMock,
}));

import { GET as expiryCronGet } from '@/app/api/internal/cron/bookings/expiry/route';
import { GET as noShowCronGet } from '@/app/api/internal/cron/bookings/no-show/route';
import { GET as retentionCronGet } from '@/app/api/internal/cron/bookings/attendance-retention/route';

describe('internal booking cron routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns unauthorized response when cron auth fails', async () => {
        const unauthorized = Response.json({ error: 'unauthorized' }, { status: 401 });
        requireCronAuthMock.mockReturnValue(unauthorized);

        const response = await expiryCronGet(new Request('http://localhost/api/internal/cron/bookings/expiry'));

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
        expect(processExpiryCheckMock).not.toHaveBeenCalled();
    });

    it('runs expiry cron route and wraps result in { data }', async () => {
        requireCronAuthMock.mockReturnValue(null);
        processExpiryCheckMock.mockResolvedValue({ processed: true, count: 3 });

        const response = await expiryCronGet(new Request('http://localhost/api/internal/cron/bookings/expiry'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: { processed: true, count: 3 },
        });
    });

    it('runs no-show cron route and wraps result in { data }', async () => {
        requireCronAuthMock.mockReturnValue(null);
        processNoShowCheckMock.mockResolvedValue({ processed: true, count: 2, failedBookingIds: [] });

        const response = await noShowCronGet(new Request('http://localhost/api/internal/cron/bookings/no-show'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: { processed: true, count: 2, failedBookingIds: [] },
        });
    });

    it('runs attendance-retention cron route and wraps result in { data }', async () => {
        requireCronAuthMock.mockReturnValue(null);
        processZoomAttendanceRetentionMock.mockResolvedValue({ processed: true, deletedCount: 7, cutoff: '2026-02-20T00:00:00.000Z' });

        const response = await retentionCronGet(new Request('http://localhost/api/internal/cron/bookings/attendance-retention'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: { processed: true, deletedCount: 7, cutoff: '2026-02-20T00:00:00.000Z' },
        });
    });

    it('returns 500 when cron processor throws', async () => {
        requireCronAuthMock.mockReturnValue(null);
        processNoShowCheckMock.mockRejectedValue(new Error('boom'));

        const response = await noShowCronGet(new Request('http://localhost/api/internal/cron/bookings/no-show'));

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'internal_error' });
    });
});
