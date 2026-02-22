import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { completeBooking, completeCall } from '@/lib/domain/bookings/transitions';
import { processExpiryCheck } from '@/lib/queues/bookings';
import { AttendanceOutcome, BookingStatus, PaymentStatus, QCStatus } from '@prisma/client';
import {
    cleanupE2EData,
    configureE2EMocks,
    createAcceptedBooking,
    createE2EActors,
    requestBookingWithAuthorizedPayment,
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

describe('Booking Status Matrix E2E', () => {
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

    it('should transition requested -> declined with payment cancelled', async () => {
        const requested = await requestBookingWithAuthorizedPayment(candidateId, professionalId, { dayOffset: 2 });

        const declined = await ProfessionalRequestService.declineBooking(
            requested.bookingId,
            professionalId,
            'No availability'
        );
        expect(declined.status).toBe(BookingStatus.declined);

        const bookingAfterDecline = await prisma.booking.findUnique({
            where: { id: requested.bookingId },
            include: { payment: true },
        });
        expect(bookingAfterDecline?.status).toBe(BookingStatus.declined);
        expect(bookingAfterDecline?.payment?.status).toBe(PaymentStatus.cancelled);
    });

    it('should transition requested -> expired through expiry worker and cancel Stripe intent', async () => {
        const requested = await requestBookingWithAuthorizedPayment(candidateId, professionalId, { dayOffset: 2 });

        await prisma.booking.update({
            where: { id: requested.bookingId },
            data: { expiresAt: new Date(Date.now() - 60_000) },
        });

        const result = await processExpiryCheck();
        expect(result.processed).toBe(true);

        const bookingAfterExpiry = await prisma.booking.findUnique({
            where: { id: requested.bookingId },
            include: { payment: true },
        });
        expect(bookingAfterExpiry?.status).toBe(BookingStatus.expired);
        expect(bookingAfterExpiry?.payment?.status).toBe(PaymentStatus.cancelled);

        const paymentIntent = await stripeTest.paymentIntents.retrieve(requested.paymentIntentId);
        expect(paymentIntent.status).toBe('canceled');
    });

    it('should transition accepted -> dispute_pending when candidate initiates dispute', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'status-dispute',
        });

        const disputePending = await CandidateBookings.initiateDispute(
            candidateId,
            accepted.bookingId,
            'quality',
            'Session quality concern'
        );
        expect(disputePending.status).toBe(BookingStatus.dispute_pending);

        const bookingAfterDispute = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
            include: { payment: true, dispute: true },
        });
        expect(bookingAfterDispute?.status).toBe(BookingStatus.dispute_pending);
        expect(bookingAfterDispute?.payment?.status).toBe(PaymentStatus.held);
        expect(bookingAfterDispute?.dispute?.status).toBe('open');
    });

    it('should transition accepted -> completed_pending_feedback -> completed', async () => {
        const accepted = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'status-completed',
        });

        const pendingFeedback = await completeCall(accepted.bookingId, {
            attendanceOutcome: AttendanceOutcome.both_joined,
        });
        expect(pendingFeedback.status).toBe(BookingStatus.completed_pending_feedback);

        await prisma.callFeedback.create({
            data: {
                bookingId: accepted.bookingId,
                text: 'Clear and practical advice',
                summary: 'Strong session',
                actions: ['Follow up on role targeting'],
                wordCount: 4,
                contentRating: 5,
                deliveryRating: 5,
                valueRating: 5,
                qcStatus: QCStatus.passed,
                submittedAt: new Date(),
            },
        });

        const completed = await completeBooking(accepted.bookingId);
        expect(completed.status).toBe(BookingStatus.completed);

        const bookingAfterComplete = await prisma.booking.findUnique({
            where: { id: accepted.bookingId },
        });
        expect(bookingAfterComplete?.status).toBe(BookingStatus.completed);
    });
});
