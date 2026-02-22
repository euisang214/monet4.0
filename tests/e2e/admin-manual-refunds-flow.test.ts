import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { auth } from '@/auth';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { BookingStatus, PaymentStatus, PayoutStatus, Role } from '@prisma/client';
import { POST as manualRefundRoute } from '@/app/api/admin/payments/refund/route';
import { PUT as resolveDisputeRoute } from '@/app/api/admin/disputes/[id]/resolve/route';
import {
    cleanupE2EData,
    configureE2EMocks,
    createAcceptedBooking,
    createE2EActors,
    createE2EAdmin,
} from './fixtures';
import { stripeTest } from '../helpers/stripe-live';

vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

vi.mock('@/lib/integrations/zoom', () => import('../mocks/zoom'));

vi.mock('@/lib/queues', () => ({
    bookingsQueue: {
        add: vi.fn(),
    },
    notificationsQueue: {
        add: vi.fn(),
    },
    qcQueue: {
        add: vi.fn(),
    },
    paymentsQueue: {
        add: vi.fn(),
    },
}));

describe('Admin Manual Refund Routes E2E', () => {
    let candidateId: string;
    let professionalId: string;
    let adminId: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        configureE2EMocks();
        const actors = await createE2EActors();
        candidateId = actors.candidateId;
        professionalId = actors.professionalId;
        adminId = await createE2EAdmin();

        vi.mocked(auth).mockResolvedValue({
            user: {
                id: adminId,
                email: `admin-${adminId}@example.com`,
                role: Role.ADMIN,
            },
            expires: '2030-01-01T00:00:00.000Z',
        } as any);
    });

    afterEach(async () => {
        await cleanupE2EData(candidateId, professionalId, adminId ? [adminId] : []);
    });

    it('should process cumulative manual partial refunds through /api/admin/payments/refund', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'admin-manual-refund',
        });

        const firstRefundResponse = await manualRefundRoute(
            new Request('http://localhost/api/admin/payments/refund', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    bookingId: accepted.bookingId,
                    amountCents: 4_000,
                }),
            })
        );
        expect(firstRefundResponse.status).toBe(200);
        expect(await firstRefundResponse.json()).toEqual({ success: true });

        const bookingAfterFirstRefund = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true },
        });
        expect(bookingAfterFirstRefund?.status).toBe(BookingStatus.accepted);
        expect(bookingAfterFirstRefund?.payment?.status).toBe(PaymentStatus.partially_refunded);
        expect(bookingAfterFirstRefund?.payment?.refundedAmountCents).toBe(4_000);

        const secondRefundResponse = await manualRefundRoute(
            new Request('http://localhost/api/admin/payments/refund', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    bookingId: accepted.bookingId,
                    amountCents: 6_000,
                }),
            })
        );
        expect(secondRefundResponse.status).toBe(200);
        expect(await secondRefundResponse.json()).toEqual({ success: true });

        const bookingAfterSecondRefund = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true },
        });
        expect(bookingAfterSecondRefund?.status).toBe(BookingStatus.refunded);
        expect(bookingAfterSecondRefund?.payment?.status).toBe(PaymentStatus.refunded);
        expect(bookingAfterSecondRefund?.payment?.refundedAmountCents).toBe(10_000);

        const refunds = await stripeTest.refunds.list({
            payment_intent: accepted.paymentIntentId,
            limit: 10,
        });
        const refundedTotal = refunds.data.reduce((sum, refund) => sum + refund.amount, 0);
        expect(refundedTotal).toBe(10_000);
    });

    it('should process dispute partial refund through /api/admin/disputes/[id]/resolve', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'admin-dispute-partial-refund',
        });
        await CandidateBookings.initiateDispute(candidateId, accepted.bookingId, 'quality', 'Needs compensation');

        const dispute = await prisma.dispute.findUniqueOrThrow({
            where: { bookingId: accepted.bookingId },
        });

        const resolveResponse = await resolveDisputeRoute(
            new Request(`http://localhost/api/admin/disputes/${dispute.id}/resolve`, {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    resolution: 'Partial refund approved',
                    action: 'partial_refund',
                    refundAmountCents: 3_000,
                }),
            }),
            { params: Promise.resolve({ id: dispute.id }) }
        );
        expect(resolveResponse.status).toBe(200);
        expect(await resolveResponse.json()).toEqual({ success: true });

        const bookingAfterResolution = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true, payout: true, dispute: true },
        });
        expect(bookingAfterResolution?.status).toBe(BookingStatus.completed);
        expect(bookingAfterResolution?.payment?.status).toBe(PaymentStatus.partially_refunded);
        expect(bookingAfterResolution?.payment?.refundedAmountCents).toBe(3_000);
        expect(bookingAfterResolution?.payout).toBeNull();
        expect(bookingAfterResolution?.dispute?.status).toBe('resolved');

        const refunds = await stripeTest.refunds.list({
            payment_intent: accepted.paymentIntentId,
            limit: 5,
        });
        expect(refunds.data.some((refund) => refund.amount === 3_000)).toBe(true);
    });

    it('should process dispute full refund through /api/admin/disputes/[id]/resolve', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'admin-dispute-full-refund',
        });
        await CandidateBookings.initiateDispute(candidateId, accepted.bookingId, 'quality', 'Session unacceptable');

        const dispute = await prisma.dispute.findUniqueOrThrow({
            where: { bookingId: accepted.bookingId },
        });

        const resolveResponse = await resolveDisputeRoute(
            new Request(`http://localhost/api/admin/disputes/${dispute.id}/resolve`, {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    resolution: 'Full refund approved',
                    action: 'full_refund',
                }),
            }),
            { params: Promise.resolve({ id: dispute.id }) }
        );
        expect(resolveResponse.status).toBe(200);
        expect(await resolveResponse.json()).toEqual({ success: true });

        const bookingAfterResolution = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true, dispute: true },
        });
        expect(bookingAfterResolution?.status).toBe(BookingStatus.refunded);
        expect(bookingAfterResolution?.payment?.status).toBe(PaymentStatus.refunded);
        expect(bookingAfterResolution?.payment?.refundedAmountCents).toBe(10_000);
        expect(bookingAfterResolution?.dispute?.status).toBe('resolved');

        const refunds = await stripeTest.refunds.list({
            payment_intent: accepted.paymentIntentId,
            limit: 5,
        });
        expect(refunds.data.some((refund) => refund.amount === 10_000)).toBe(true);
    });

    it('should process dispute dismiss to payout release through /api/admin/disputes/[id]/resolve', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'admin-dispute-dismiss',
        });
        await CandidateBookings.initiateDispute(candidateId, accepted.bookingId, 'quality', 'Disputed session');

        const dispute = await prisma.dispute.findUniqueOrThrow({
            where: { bookingId: accepted.bookingId },
        });

        const resolveResponse = await resolveDisputeRoute(
            new Request(`http://localhost/api/admin/disputes/${dispute.id}/resolve`, {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    resolution: 'Dispute dismissed',
                    action: 'dismiss',
                }),
            }),
            { params: Promise.resolve({ id: dispute.id }) }
        );
        expect(resolveResponse.status).toBe(200);
        expect(await resolveResponse.json()).toEqual({ success: true });

        const bookingAfterResolution = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true, payout: true, professional: true, dispute: true },
        });
        expect(bookingAfterResolution?.status).toBe(BookingStatus.completed);
        expect(bookingAfterResolution?.payment?.status).toBe(PaymentStatus.released);
        expect(bookingAfterResolution?.payout?.status).toBe(PayoutStatus.paid);
        expect(bookingAfterResolution?.payout?.stripeTransferId).toBeTruthy();
        expect(bookingAfterResolution?.dispute?.status).toBe('resolved');

        const transfer = await stripeTest.transfers.retrieve(bookingAfterResolution!.payout!.stripeTransferId!);
        expect(transfer.destination).toBe(bookingAfterResolution?.professional.stripeAccountId);
        expect(transfer.amount).toBe(8_000);

        const refunds = await stripeTest.refunds.list({
            payment_intent: accepted.paymentIntentId,
            limit: 5,
        });
        expect(refunds.data.length).toBe(0);
    });
});
