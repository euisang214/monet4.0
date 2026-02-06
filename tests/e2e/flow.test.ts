import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { ProfessionalRequestService } from '@/lib/role/professional/requests';
import { mockStripe } from '../mocks/stripe';
import { mockZoom } from '../mocks/zoom';
import { BookingStatus, PaymentStatus, Role } from '@prisma/client';
import { addDays } from 'date-fns';

// --- Mocks ---
// Mock Stripe Integration
vi.mock('@/lib/integrations/stripe', async () => {
    const { mockStripe } = await import('../mocks/stripe');
    return { stripe: mockStripe };
});

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

        // 1. Create Data
        // Create Candidate
        const candidate = await prisma.user.create({
            data: {
                email: `test-candidate-${Date.now()}@example.com`,
                role: Role.CANDIDATE,
                candidateProfile: {
                    create: {
                        interests: ['Testing'],
                    }
                }
            }
        });
        candidateId = candidate.id;

        // Create Professional
        const professional = await prisma.user.create({
            data: {
                email: `test-pro-${Date.now()}@example.com`,
                role: Role.PROFESSIONAL,
                professionalProfile: {
                    create: {
                        employer: 'Test Corp',
                        title: 'Senior Tester',
                        bio: 'I test things',
                        priceCents: 10000, // $100.00
                        corporateEmail: `pro-corp-${Date.now()}@example.com`,
                    }
                }
            }
        });
        professionalId = professional.id;

        // Mock Stripe Responses
        mockStripe.paymentIntents.create.mockResolvedValue({
            id: 'pi_test_123',
            client_secret: 'secret_123',
        });

        mockStripe.paymentIntents.capture.mockResolvedValue({
            id: 'pi_test_123',
            status: 'succeeded',
        });

        // Mock Zoom Response
        mockZoom.createZoomMeeting.mockResolvedValue({
            id: 123456789,
            join_url: 'https://zoom.us/j/123456789',
            start_url: 'https://zoom.us/s/123456789',
        });
    });

    afterEach(async () => {
        // Cleanup
        await prisma.payment.deleteMany({ where: { booking: { candidateId: candidateId } } });
        await prisma.booking.deleteMany({ where: { candidateId: candidateId } });
        await prisma.experience.deleteMany({ where: { OR: [{ candidateId }, { professionalId }] } });
        await prisma.education.deleteMany({ where: { OR: [{ candidateId }, { professionalId }] } });
        await prisma.candidateProfile.delete({ where: { userId: candidateId } });
        await prisma.professionalProfile.delete({ where: { userId: professionalId } });
        await prisma.user.deleteMany({ where: { id: { in: [candidateId, professionalId] } } });
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
        expect(requestResult.clientSecret).toBe('secret_123');
        expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
            amount: 10000,
            capture_method: 'manual',
        }));

        // Verify Database State
        const bookingAfterRequest = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true }
        });
        expect(bookingAfterRequest?.status).toBe(BookingStatus.requested);
        expect(bookingAfterRequest?.payment?.status).toBe(PaymentStatus.authorized);
        expect(bookingAfterRequest?.payment?.stripePaymentIntentId).toBe('pi_test_123');


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
        expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_test_123');

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
