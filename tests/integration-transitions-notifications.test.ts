import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';

vi.mock('@/lib/queues', () => ({
    notificationsQueue: {
        add: vi.fn(),
    },
}));

import { notificationsQueue } from '@/lib/queues';
import {
    acceptBookingWithIntegrations,
    completeIntegrations,
    updateZoomDetails,
} from '@/lib/domain/bookings/transitions';

function buildPrismaMock() {
    const tx = {
        booking: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        payment: {
            updateMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn().mockResolvedValue({ id: 'audit_1' }),
        },
    };

    const prisma = {
        ...tx,
        $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    return { prisma, tx };
}

describe('Integration transition notification semantics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not queue booking_accepted when moving requested -> accepted_pending_integrations', async () => {
        const { prisma, tx } = buildPrismaMock();

        const before = {
            id: 'booking_1',
            professionalId: 'pro_1',
            status: BookingStatus.requested,
            payment: { status: PaymentStatus.authorized },
            payout: null,
            feedback: null,
            startAt: new Date('2026-02-20T10:00:00Z'),
            endAt: new Date('2026-02-20T10:30:00Z'),
            candidateLateCancellation: false,
        };

        const after = {
            ...before,
            status: BookingStatus.accepted_pending_integrations,
            payment: { status: PaymentStatus.held },
        };

        tx.booking.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
        tx.booking.findUniqueOrThrow.mockResolvedValue(before);
        tx.booking.update.mockResolvedValue(after);
        tx.payment.updateMany.mockResolvedValue({ count: 1 });

        const result = await acceptBookingWithIntegrations(
            'booking_1',
            { userId: 'pro_1', role: Role.PROFESSIONAL },
            { prisma: prisma as any },
        );

        expect(result.status).toBe(BookingStatus.accepted_pending_integrations);
        expect(notificationsQueue.add).not.toHaveBeenCalled();
    });

    it('queues booking_accepted after completeIntegrations succeeds', async () => {
        const { prisma, tx } = buildPrismaMock();

        const before = {
            id: 'booking_2',
            professionalId: 'pro_1',
            status: BookingStatus.accepted_pending_integrations,
            payment: { status: PaymentStatus.held },
            payout: null,
            feedback: null,
            startAt: new Date('2026-02-21T10:00:00Z'),
            endAt: new Date('2026-02-21T10:30:00Z'),
            candidateLateCancellation: false,
            zoomJoinUrl: null,
            zoomMeetingId: null,
        };

        const after = {
            ...before,
            status: BookingStatus.accepted,
            zoomJoinUrl: 'https://zoom.us/j/123456',
            zoomMeetingId: '123456',
        };

        tx.booking.findUnique.mockResolvedValueOnce(before).mockResolvedValueOnce(after);
        tx.booking.findUniqueOrThrow.mockResolvedValue(before);
        tx.booking.update.mockResolvedValue(after);

        await completeIntegrations(
            'booking_2',
            { joinUrl: 'https://zoom.us/j/123456', meetingId: '123456' },
            { prisma: prisma as any },
        );

        expect(notificationsQueue.add).toHaveBeenCalledWith(
            'notifications',
            { type: 'booking_accepted', bookingId: 'booking_2' },
            {
                jobId: 'booking-accepted-booking_2-123456',
                attempts: 3,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    });

    it('queues booking_accepted when admin fallback transitions accepted_pending_integrations -> accepted', async () => {
        const { prisma } = buildPrismaMock();

        prisma.booking.findUnique.mockResolvedValue({ status: BookingStatus.accepted_pending_integrations });
        prisma.booking.update.mockResolvedValue({
            id: 'booking_3',
            status: BookingStatus.accepted,
            zoomJoinUrl: 'https://zoom.us/j/manual',
            zoomMeetingId: 'manual-1',
        });

        await updateZoomDetails(
            'booking_3',
            {
                zoomJoinUrl: 'https://zoom.us/j/manual',
                zoomMeetingId: 'manual-1',
            },
            { userId: 'admin_1', role: Role.ADMIN },
            { prisma: prisma as any },
        );

        expect(notificationsQueue.add).toHaveBeenCalledWith(
            'notifications',
            { type: 'booking_accepted', bookingId: 'booking_3' },
            { jobId: 'booking-accepted-booking_3-manual-1' },
        );
    });
});
