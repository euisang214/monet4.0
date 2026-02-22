import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { cancelBooking as transitionCancel } from '@/lib/domain/bookings/transitions';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';
import { addHours } from 'date-fns';
import { configureE2EMocks, createAcceptedBooking, createE2EActors, cleanupE2EData } from './fixtures';
import { stripeTest } from '../helpers/stripe-live';

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

describe('Cancellation Flow E2E', () => {
    let candidateId: string;
    let professionalId: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        configureE2EMocks();
        const actors = await createE2EActors();
        candidateId = actors.candidateId;
        professionalId = actors.professionalId;
    });

    afterEach(async () => {
        await cleanupE2EData(candidateId, professionalId);
    });

    it('should complete candidate-initiated cancellation flow from accepted booking to refund', async () => {
        const { bookingId, paymentIntentId } = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 3,
            meetingId: 'candidate-cancel-flow',
        });

        const cancelResult = await CandidateBookings.cancelBooking(candidateId, bookingId, 'Schedule conflict');
        expect(cancelResult.status).toBe(BookingStatus.cancelled);

        const bookingAfterCancel = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true, payout: true },
        });

        expect(bookingAfterCancel?.status).toBe(BookingStatus.cancelled);
        expect(bookingAfterCancel?.candidateLateCancellation).toBe(false);
        expect(bookingAfterCancel?.payment?.status).toBe(PaymentStatus.refunded);
        expect(bookingAfterCancel?.payment?.refundedAmountCents).toBe(10000);
        expect(bookingAfterCancel?.payout).toBeNull();

        const refunds = await stripeTest.refunds.list({ payment_intent: paymentIntentId, limit: 5 });
        expect(refunds.data.length).toBeGreaterThan(0);
        expect(refunds.data[0].amount).toBe(10_000);
    });

    it('should complete professional-initiated cancellation flow from accepted booking to refund', async () => {
        const { bookingId, paymentIntentId } = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 3,
            meetingId: 'professional-cancel-flow',
        });

        const cancelResult = await transitionCancel(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL },
            'Professional conflict'
        );
        expect(cancelResult.status).toBe(BookingStatus.cancelled);

        const bookingAfterCancel = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true, payout: true },
        });

        expect(bookingAfterCancel?.status).toBe(BookingStatus.cancelled);
        expect(bookingAfterCancel?.candidateLateCancellation).toBe(false);
        expect(bookingAfterCancel?.payment?.status).toBe(PaymentStatus.refunded);
        expect(bookingAfterCancel?.payment?.refundedAmountCents).toBe(10000);
        expect(bookingAfterCancel?.payout).toBeNull();

        const refunds = await stripeTest.refunds.list({ payment_intent: paymentIntentId, limit: 5 });
        expect(refunds.data.length).toBeGreaterThan(0);
        expect(refunds.data[0].amount).toBe(10_000);
    });

    it('should keep professional-initiated late cancellation on refund path (no late payout)', async () => {
        const startAt = addHours(new Date(), 2);
        const { bookingId, paymentIntentId } = await createAcceptedBooking(candidateId, professionalId, {
            scheduledStartAt: startAt,
            meetingId: 'professional-late-cancel-flow',
        });

        const cancelResult = await transitionCancel(
            bookingId,
            { userId: professionalId, role: Role.PROFESSIONAL },
            'Professional conflict (late)'
        );
        expect(cancelResult.status).toBe(BookingStatus.cancelled);

        const bookingAfterCancel = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true, payout: true },
        });

        expect(bookingAfterCancel?.status).toBe(BookingStatus.cancelled);
        expect(bookingAfterCancel?.candidateLateCancellation).toBe(false);
        expect(bookingAfterCancel?.payment?.status).toBe(PaymentStatus.refunded);
        expect(bookingAfterCancel?.payment?.refundedAmountCents).toBe(10_000);
        expect(bookingAfterCancel?.payout).toBeNull();

        const refunds = await stripeTest.refunds.list({ payment_intent: paymentIntentId, limit: 5 });
        expect(refunds.data.length).toBeGreaterThan(0);
        expect(refunds.data[0].amount).toBe(10_000);
    });
});
