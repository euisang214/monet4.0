import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';

const authMock = vi.hoisted(() => vi.fn());
const getBookingCandidateAvailabilityMock = vi.hoisted(() => vi.fn());
const confirmAndScheduleMock = vi.hoisted(() => vi.fn());
const processManualRefundMock = vi.hoisted(() => vi.fn());

vi.mock('@/auth', () => ({
    auth: authMock,
}));

vi.mock('@/lib/role/professional/requests', () => ({
    ProfessionalRequestService: {
        getBookingCandidateAvailability: getBookingCandidateAvailabilityMock,
        confirmAndSchedule: confirmAndScheduleMock,
    },
}));

vi.mock('@/lib/domain/payments/services', () => ({
    PaymentsService: {
        processManualRefund: processManualRefundMock,
    },
}));

import { GET as getProfessionalAvailabilityRoute } from '@/app/api/professional/requests/[id]/confirm-and-schedule/route';
import { POST as adminRefundRoute } from '@/app/api/admin/payments/refund/route';

describe('routes migrated to withRoleContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 403 for professional confirm/schedule route when unauthenticated', async () => {
        authMock.mockResolvedValue(null);

        const response = await getProfessionalAvailabilityRoute(
            new Request('http://localhost/api/professional/requests/b1/confirm-and-schedule'),
            { params: Promise.resolve({ id: 'b1' }) } as any,
        );

        expect(response.status).toBe(403);
        expect(getBookingCandidateAvailabilityMock).not.toHaveBeenCalled();
    });

    it('injects authenticated professional user into route service calls', async () => {
        authMock.mockResolvedValue({
            user: {
                id: 'pro-123',
                role: Role.PROFESSIONAL,
                onboardingRequired: false,
                onboardingCompleted: true,
            },
        });
        getBookingCandidateAvailabilityMock.mockResolvedValue([{ start: 'slot' }]);

        const response = await getProfessionalAvailabilityRoute(
            new Request('http://localhost/api/professional/requests/b1/confirm-and-schedule'),
            { params: Promise.resolve({ id: 'booking-1' }) } as any,
        );

        expect(response.status).toBe(200);
        expect(getBookingCandidateAvailabilityMock).toHaveBeenCalledWith('booking-1', 'pro-123');
        await expect(response.json()).resolves.toEqual({ data: [{ start: 'slot' }] });
    });

    it('passes admin user id from context to payments refund service', async () => {
        authMock.mockResolvedValue({
            user: {
                id: 'admin-1',
                role: Role.ADMIN,
            },
        });

        const response = await adminRefundRoute(
            new Request('http://localhost/api/admin/payments/refund', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ bookingId: 'booking-1', amountCents: 1000 }),
            }),
        );

        expect(response.status).toBe(200);
        expect(processManualRefundMock).toHaveBeenCalledWith('booking-1', 1000, 'admin-1');
    });

    it('returns validation_error for malformed admin refund payloads', async () => {
        authMock.mockResolvedValue({
            user: {
                id: 'admin-1',
                role: Role.ADMIN,
            },
        });

        const response = await adminRefundRoute(
            new Request('http://localhost/api/admin/payments/refund', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ bookingId: '' }),
            }),
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual(
            expect.objectContaining({ error: 'validation_error' }),
        );
        expect(processManualRefundMock).not.toHaveBeenCalled();
    });
});
