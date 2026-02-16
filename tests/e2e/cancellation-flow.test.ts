import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { cancelBooking as transitionCancel, completeIntegrations } from '@/lib/domain/bookings/transitions';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';
import { addDays, addMinutes } from 'date-fns';
import { configureE2EMocks, createE2EActors, cleanupE2EData } from './fixtures';

vi.mock('@/lib/integrations/stripe', async () => {
    const { mockStripe } = await import('../mocks/stripe');
    return { stripe: mockStripe };
});

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

    async function createAcceptedBooking(dayOffset: number, meetingId: string) {
        const proposedStart = addDays(new Date(), dayOffset);
        proposedStart.setMinutes(0, 0, 0);
        const proposedEnd = addMinutes(proposedStart, 30);

        const requestResult = await CandidateBookings.requestBooking(candidateId, {
            professionalId,
            weeks: 2,
            availabilitySlots: [{ start: proposedStart.toISOString(), end: proposedEnd.toISOString() }],
            timezone: 'UTC',
        });

        const bookingId = requestResult.booking.id;
        const startAt = addDays(new Date(), dayOffset);
        const acceptResult = await ProfessionalRequestService.confirmAndSchedule(
            bookingId,
            professionalId,
            startAt
        );
        expect(acceptResult.status).toBe(BookingStatus.accepted_pending_integrations);

        await completeIntegrations(bookingId, {
            joinUrl: `https://zoom.us/j/${meetingId}`,
            meetingId,
        });

        const acceptedBooking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });
        expect(acceptedBooking?.status).toBe(BookingStatus.accepted);
        expect(acceptedBooking?.payment?.status).toBe(PaymentStatus.held);

        return bookingId;
    }

    it('should complete candidate-initiated cancellation flow from accepted booking to refund', async () => {
        const bookingId = await createAcceptedBooking(3, 'candidate-cancel-flow');

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
    });

    it('should complete professional-initiated cancellation flow from accepted booking to refund', async () => {
        const bookingId = await createAcceptedBooking(3, 'professional-cancel-flow');

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
    });
});
