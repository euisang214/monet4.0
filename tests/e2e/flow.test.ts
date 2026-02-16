import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { addDays } from 'date-fns';
import { configureE2EMocks, createE2EActors, cleanupE2EData } from './fixtures';
import { confirmPaymentIntentForCapture } from '../helpers/stripe-live';

// --- Mocks ---
// Mock Zoom Integration
vi.mock('@/lib/integrations/zoom', () => import('../mocks/zoom'));

// Mock Queue to prevent actual BullMQ/Redis connections
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

describe('Golden Path E2E: Book -> Pay -> Accept', () => {
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

    it('should successfully request and accept a booking', async () => {
        // --- Step 1: Candidate Requests Booking ---
        const weeks = 2; // Arbitrary input for booking request
        const proposedStart = addDays(new Date(), 1);
        proposedStart.setMinutes(0, 0, 0);
        const proposedEnd = new Date(proposedStart);
        proposedEnd.setMinutes(proposedEnd.getMinutes() + 30);

        const requestResult = await CandidateBookings.requestBooking(candidateId, {
            professionalId,
            weeks,
            availabilitySlots: [{ start: proposedStart.toISOString(), end: proposedEnd.toISOString() }],
            timezone: 'UTC',
        });

        const bookingId = requestResult.booking.id;

        // Assert Step 1
        expect(requestResult.booking.status).toBe(BookingStatus.requested);
        expect(requestResult.clientSecret).toBeTruthy();
        expect(requestResult.stripePaymentIntentId.startsWith('pi_')).toBe(true);

        // Move PI into requires_capture so professional accept can capture it.
        await confirmPaymentIntentForCapture(requestResult.stripePaymentIntentId);

        // Verify Database State
        const bookingAfterRequest = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true }
        });
        expect(bookingAfterRequest?.status).toBe(BookingStatus.requested);
        expect(bookingAfterRequest?.payment?.status).toBe(PaymentStatus.authorized);
        expect(bookingAfterRequest?.payment?.stripePaymentIntentId).toBe(requestResult.stripePaymentIntentId);


        // --- Step 2: Professional Accepts Booking ---
        const startAt = addDays(new Date(), 1); // Schedule for tomorrow

        // Ensure the paymentIntentId is set on the booking's payment record before confirming
        // (It was set in Step 1, verified above)

        const acceptResult = await ProfessionalRequestService.confirmAndSchedule(
            bookingId,
            professionalId,
            startAt
        );

        // Assert Step 2: Helper returns `accepted_pending_integrations` and queues job
        expect(acceptResult.status).toBe(BookingStatus.accepted_pending_integrations);

        // Verify Database State
        const bookingAfterAccept = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true }
        });

        // Assertions per User Request:
        // "Assert: Booking status is accepted" (Technically accepted_pending_integrations immediately)
        // "Assert: Payment is held"

        // NOTE: The facade returns `accepted_pending_integrations` immediately.
        // The background job would flip it to `accepted`.
        // Since we are mocking the queue, it stops here. Validating `accepted_pending_integrations` is correct for E2E of the API layer.

        expect(bookingAfterAccept?.status).toBe(BookingStatus.accepted_pending_integrations);
        expect(bookingAfterAccept?.payment?.status).toBe(PaymentStatus.held);

        // Verify Start Time was set
        expect(bookingAfterAccept?.startAt).toEqual(startAt);
    });
});
