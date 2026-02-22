import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/core/db';
import { CandidateBookings } from '@/lib/role/candidate/bookings';
import { ProfessionalRescheduleService } from '@/lib/role/professional/reschedule';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { addDays, addMinutes } from 'date-fns';
import { configureE2EMocks, createAcceptedBooking, createE2EActors, cleanupE2EData } from './fixtures';

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

describe('Reschedule Flow E2E', () => {
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

    it('should complete candidate-initiated reschedule flow through professional confirmation', async () => {
        const { bookingId } = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'candidate-reschedule-old',
        });

        const candidateSlotStart = addDays(new Date(), 3);
        candidateSlotStart.setMinutes(0, 0, 0);
        const candidateSlotEnd = addMinutes(candidateSlotStart, 30);

        const rescheduleRequest = await CandidateBookings.requestReschedule(
            candidateId,
            bookingId,
            [{ start: candidateSlotStart, end: candidateSlotEnd }],
            'Need a different time',
            'UTC'
        );
        expect(rescheduleRequest.status).toBe(BookingStatus.reschedule_pending);

        const bookingAfterRescheduleRequest = await prisma.booking.findUnique({
            where: { id: bookingId },
        });
        expect(bookingAfterRescheduleRequest?.status).toBe(BookingStatus.reschedule_pending);

        const newStartAt = addDays(new Date(), 4);
        newStartAt.setMinutes(0, 0, 0);
        const expectedEndAt = addMinutes(newStartAt, 30);

        const confirmRescheduleResult = await ProfessionalRescheduleService.confirmReschedule(
            bookingId,
            professionalId,
            newStartAt
        );
        expect(confirmRescheduleResult.status).toBe(BookingStatus.accepted);

        const bookingAfterRescheduleConfirm = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });

        expect(bookingAfterRescheduleConfirm?.status).toBe(BookingStatus.accepted);
        expect(bookingAfterRescheduleConfirm?.startAt).toEqual(newStartAt);
        expect(bookingAfterRescheduleConfirm?.endAt).toEqual(expectedEndAt);
        expect(bookingAfterRescheduleConfirm?.payment?.status).toBe(PaymentStatus.held);
    });

    it('should complete professional-initiated reschedule flow through professional confirmation', async () => {
        const { bookingId } = await createAcceptedBooking(candidateId, professionalId, {
            dayOffset: 2,
            meetingId: 'professional-reschedule-old',
        });

        const professionalRequestResult = await ProfessionalRescheduleService.requestReschedule(
            bookingId,
            professionalId,
            'Running conflict'
        );
        expect(professionalRequestResult.status).toBe(BookingStatus.reschedule_pending);

        const duplicateProfessionalRequest = await ProfessionalRescheduleService.requestReschedule(
            bookingId,
            professionalId,
            'Retry click'
        );
        expect(duplicateProfessionalRequest.status).toBe(BookingStatus.reschedule_pending);

        const bookingAfterProRequest = await prisma.booking.findUnique({
            where: { id: bookingId },
        });
        expect(bookingAfterProRequest?.status).toBe(BookingStatus.reschedule_pending);

        const newStartAt = addDays(new Date(), 5);
        newStartAt.setMinutes(0, 0, 0);
        const expectedEndAt = addMinutes(newStartAt, 30);

        const confirmResult = await ProfessionalRescheduleService.confirmReschedule(
            bookingId,
            professionalId,
            newStartAt
        );
        expect(confirmResult.status).toBe(BookingStatus.accepted);

        const bookingAfterProConfirm = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });
        expect(bookingAfterProConfirm?.status).toBe(BookingStatus.accepted);
        expect(bookingAfterProConfirm?.startAt).toEqual(newStartAt);
        expect(bookingAfterProConfirm?.endAt).toEqual(expectedEndAt);
        expect(bookingAfterProConfirm?.payment?.status).toBe(PaymentStatus.held);
    });
});
