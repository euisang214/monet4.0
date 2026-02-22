import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/core/db';
import { processNoShowCheck } from '@/lib/queues/bookings';
import { AttendanceOutcome, BookingStatus, PaymentStatus, PayoutStatus } from '@prisma/client';
import {
    cleanupE2EData,
    configureE2EMocks,
    createAcceptedBooking,
    createE2EActors,
} from './fixtures';
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

describe('No-Show and Late Cancellation E2E', () => {
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

    it('should process candidate no-show to late-cancel payout path', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'noshow-candidate',
        });

        const startAt = new Date(Date.now() - 30 * 60 * 1000);
        const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
        await prisma.booking.update({
            where: { id: accepted.bookingId },
            data: {
                startAt,
                endAt,
                candidateJoinedAt: null,
                professionalJoinedAt: new Date(startAt.getTime() + 2 * 60 * 1000),
                attendanceOutcome: null,
            },
        });

        const result = await processNoShowCheck();
        expect(result.processed).toBe(true);
        expect(result.failedBookingIds).toEqual([]);

        const bookingAfterNoShow = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true, payout: true, dispute: true },
        });

        expect(bookingAfterNoShow?.status).toBe(BookingStatus.cancelled);
        expect(bookingAfterNoShow?.attendanceOutcome).toBe(AttendanceOutcome.candidate_no_show);
        expect(bookingAfterNoShow?.candidateLateCancellation).toBe(true);
        expect(bookingAfterNoShow?.payment?.status).toBe(PaymentStatus.released);
        expect(bookingAfterNoShow?.payout?.status).toBe(PayoutStatus.pending);
        expect(bookingAfterNoShow?.dispute).toBeNull();

        const refunds = await stripeTest.refunds.list({ payment_intent: accepted.paymentIntentId, limit: 5 });
        expect(refunds.data.length).toBe(0);
    });

    it('should process professional no-show to dispute_pending', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'noshow-professional',
        });

        const startAt = new Date(Date.now() - 30 * 60 * 1000);
        const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
        await prisma.booking.update({
            where: { id: accepted.bookingId },
            data: {
                startAt,
                endAt,
                candidateJoinedAt: new Date(startAt.getTime() + 2 * 60 * 1000),
                professionalJoinedAt: null,
                attendanceOutcome: null,
            },
        });

        const result = await processNoShowCheck();
        expect(result.processed).toBe(true);
        expect(result.failedBookingIds).toEqual([]);

        const bookingAfterNoShow = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true, dispute: true },
        });

        expect(bookingAfterNoShow?.status).toBe(BookingStatus.dispute_pending);
        expect(bookingAfterNoShow?.attendanceOutcome).toBe(AttendanceOutcome.professional_no_show);
        expect(bookingAfterNoShow?.payment?.status).toBe(PaymentStatus.held);
        expect(bookingAfterNoShow?.dispute?.status).toBe('open');
        expect(bookingAfterNoShow?.dispute?.reason).toBe('no_show');
        expect(bookingAfterNoShow?.dispute?.initiatorId).toBe(candidateId);
    });
});
