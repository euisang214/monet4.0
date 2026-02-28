import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';

const notificationsQueueAddMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/queues', () => ({
    notificationsQueue: {
        add: notificationsQueueAddMock,
    },
}));

function buildPrismaMock() {
    const tx = {
        booking: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        payment: {
            updateMany: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
        },
        payout: {
            create: vi.fn(),
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
        vi.resetModules();
        vi.unstubAllEnvs();
    });

    it('does not queue accepted notifications when moving requested -> accepted_pending_integrations', async () => {
        const { acceptBookingWithIntegrations } = await import('@/lib/domain/bookings/transitions');
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
        expect(notificationsQueueAddMock).not.toHaveBeenCalled();
    });

    it('queues two calendar_invite_request jobs when integrations complete', async () => {
        const { completeIntegrations } = await import('@/lib/domain/bookings/transitions');
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

        expect(notificationsQueueAddMock).toHaveBeenCalledTimes(2);
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_request',
                bookingId: 'booking_2',
                recipientRole: 'CANDIDATE',
                revisionKey: '123456',
            },
            {
                jobId: 'cal-req-booking_2-CANDIDATE-123456',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_request',
                bookingId: 'booking_2',
                recipientRole: 'PROFESSIONAL',
                revisionKey: '123456',
            },
            {
                jobId: 'cal-req-booking_2-PROFESSIONAL-123456',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    });

    it('queues two calendar_invite_request jobs when admin fallback transitions accepted_pending_integrations -> accepted', async () => {
        const { updateZoomDetails } = await import('@/lib/domain/bookings/transitions');
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

        expect(notificationsQueueAddMock).toHaveBeenCalledTimes(2);
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_request',
                bookingId: 'booking_3',
                recipientRole: 'CANDIDATE',
                revisionKey: 'manual-1',
            },
            {
                jobId: 'cal-req-booking_3-CANDIDATE-manual-1',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_request',
                bookingId: 'booking_3',
                recipientRole: 'PROFESSIONAL',
                revisionKey: 'manual-1',
            },
            {
                jobId: 'cal-req-booking_3-PROFESSIONAL-manual-1',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    });

    it('queues two calendar_invite_cancel jobs when cancelBooking performs a real cancellation', async () => {
        const { cancelBooking } = await import('@/lib/domain/bookings/transitions');
        const { prisma, tx } = buildPrismaMock();

        const before = {
            id: 'booking_cancel_1',
            candidateId: 'cand_1',
            professionalId: 'pro_1',
            status: BookingStatus.accepted,
            zoomMeetingId: 'meeting-cancel-1',
            priceCents: 10000,
            startAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            endAt: new Date(Date.now() + 12.5 * 60 * 60 * 1000),
            candidateLateCancellation: false,
            attendanceOutcome: null,
            payment: { status: PaymentStatus.held },
            payout: null,
            feedback: null,
        };

        const after = {
            ...before,
            status: BookingStatus.cancelled,
            payment: { status: PaymentStatus.refunded },
        };

        tx.booking.findUnique
            .mockResolvedValueOnce(before) // transitionBooking lock/fetch
            .mockResolvedValueOnce(after); // transitionBooking post-update invariant fetch
        tx.booking.findUniqueOrThrow.mockResolvedValue(before);
        tx.booking.update.mockResolvedValue(after);
        tx.payment.findUnique.mockResolvedValue({
            bookingId: 'booking_cancel_1',
            status: PaymentStatus.held,
            amountGross: 10000,
            stripePaymentIntentId: 'pi_1',
        });
        tx.payment.update.mockResolvedValue({});

        await cancelBooking(
            'booking_cancel_1',
            { userId: 'cand_1', role: Role.CANDIDATE },
            'change of plans',
            undefined,
            { prisma: prisma as any, stripe: undefined },
        );

        expect(notificationsQueueAddMock).toHaveBeenCalledTimes(2);
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_cancel',
                bookingId: 'booking_cancel_1',
                recipientRole: 'CANDIDATE',
            },
            {
                jobId: 'cal-cxl-booking_cancel_1-CANDIDATE',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_cancel',
                bookingId: 'booking_cancel_1',
                recipientRole: 'PROFESSIONAL',
            },
            {
                jobId: 'cal-cxl-booking_cancel_1-PROFESSIONAL',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    });

    it('queues two calendar_invite_cancel jobs when rejectReschedule cancels a booking', async () => {
        const { rejectReschedule } = await import('@/lib/domain/bookings/transitions');
        const { prisma, tx } = buildPrismaMock();

        const before = {
            id: 'booking_cancel_2',
            candidateId: 'cand_1',
            professionalId: 'pro_1',
            status: BookingStatus.reschedule_pending,
            zoomMeetingId: 'meeting-cancel-2',
            priceCents: 10000,
            startAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            endAt: new Date(Date.now() + 12.5 * 60 * 60 * 1000),
            candidateLateCancellation: false,
            payment: { status: PaymentStatus.held },
            payout: null,
            feedback: null,
        };

        const after = {
            ...before,
            status: BookingStatus.cancelled,
            payment: { status: PaymentStatus.refunded },
        };

        tx.booking.findUnique
            .mockResolvedValueOnce(before) // transitionBooking lock/fetch
            .mockResolvedValueOnce(after); // transitionBooking post-update invariant fetch
        tx.booking.findUniqueOrThrow.mockResolvedValue(before);
        tx.booking.update.mockResolvedValue(after);
        tx.payment.update.mockResolvedValue({});

        await rejectReschedule(
            'booking_cancel_2',
            { userId: 'cand_1', role: Role.CANDIDATE },
            { prisma: prisma as any },
        );

        expect(notificationsQueueAddMock).toHaveBeenCalledTimes(2);
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_cancel',
                bookingId: 'booking_cancel_2',
                recipientRole: 'CANDIDATE',
            },
            {
                jobId: 'cal-cxl-booking_cancel_2-CANDIDATE',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_cancel',
                bookingId: 'booking_cancel_2',
                recipientRole: 'PROFESSIONAL',
            },
            {
                jobId: 'cal-cxl-booking_cancel_2-PROFESSIONAL',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    });
});
