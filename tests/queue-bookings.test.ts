import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, PaymentStatus, AttendanceOutcome } from '@prisma/client';

/**
 * Queue Worker Tests - Bookings
 * 
 * Tests the queue worker logic with simplified mocks.
 * Complex Prisma transaction mocking is challenging - these tests
 * focus on the direct function logic rather than full integration.
 */

// Mock prisma with complete transaction support
vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        payment: {
            update: vi.fn(),
            updateMany: vi.fn(),
        },
        auditLog: {
            create: vi.fn(),
        },
    },
}));

vi.mock('@/lib/integrations/zoom', () => ({
    createZoomMeeting: vi.fn(),
    deleteZoomMeeting: vi.fn(),
}));

vi.mock('@/lib/integrations/calendar/google', () => ({
    createGoogleCalendarEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/integrations/email', () => ({
    sendBookingAcceptedEmail: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/integrations/stripe', () => ({
    stripe: {},
    cancelPaymentIntent: vi.fn(),
}));

// Mock the transition functions (they're the complex parts with Prisma transactions)
vi.mock('@/lib/domain/bookings/transitions', () => ({
    expireBooking: vi.fn(),
    completeCall: vi.fn(),
    cancelBooking: vi.fn(),
    initiateDispute: vi.fn(),
    completeIntegrations: vi.fn().mockResolvedValue({}),
}));

// Import after mocks
import { prisma } from '@/lib/core/db';
import { createZoomMeeting, deleteZoomMeeting } from '@/lib/integrations/zoom';
import { cancelPaymentIntent } from '@/lib/integrations/stripe';
import { expireBooking, cancelBooking, initiateDispute, completeCall, completeIntegrations } from '@/lib/domain/bookings/transitions';
import {
    processConfirmBooking,
    processRescheduleBooking,
    processExpiryCheck,
    processNoShowCheck,
} from '@/lib/queues/bookings';

describe('Booking Queue Workers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('processConfirmBooking', () => {
        it('should create Zoom meeting and update booking', async () => {
            const mockBooking = {
                id: 'booking_123',
                candidateId: 'cand_1',
                professionalId: 'pro_1',
                startAt: new Date('2026-01-30T10:00:00Z'),
                endAt: new Date('2026-01-30T11:00:00Z'),
                status: BookingStatus.accepted_pending_integrations,
                zoomMeetingId: null,
                zoomJoinUrl: null,
                candidate: { email: 'cand@test.com', name: 'Cand', timezone: 'UTC' },
                professional: { email: 'pro@test.com', name: 'Pro' },
            };

            vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);
            vi.mocked(createZoomMeeting).mockResolvedValue({
                id: 123456,
                join_url: 'https://zoom.us/j/123456',
                start_url: 'https://zoom.us/s/123456',
            });
            vi.mocked(prisma.booking.update).mockResolvedValue({
                ...mockBooking,
                status: BookingStatus.accepted,
                zoomJoinUrl: 'https://zoom.us/j/123456',
                zoomMeetingId: '123456',
            } as any);

            const result = await processConfirmBooking('booking_123');

            expect(createZoomMeeting).toHaveBeenCalled();
            expect(completeIntegrations).toHaveBeenCalledWith('booking_123', {
                joinUrl: 'https://zoom.us/j/123456',
                meetingId: '123456',
            });
            expect(result.processed).toBe(true);
        });

        it('should throw error if booking not found', async () => {
            vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

            await expect(processConfirmBooking('nonexistent')).rejects.toThrow('not found');
            expect(createZoomMeeting).not.toHaveBeenCalled();
        });

        it('should skip Zoom creation if already has meeting ID', async () => {
            const mockBooking = {
                id: 'booking_123',
                startAt: new Date(),
                endAt: new Date(),
                zoomMeetingId: 'existing_123',
                zoomJoinUrl: 'https://zoom.us/existing',
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            };

            vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);

            await processConfirmBooking('booking_123');

            expect(createZoomMeeting).not.toHaveBeenCalled();
        });
    });

    describe('processRescheduleBooking', () => {
        it('should delete old Zoom and create new one', async () => {
            const mockBooking = {
                id: 'booking_123',
                startAt: new Date('2026-01-31T10:00:00Z'),
                endAt: new Date('2026-01-31T11:00:00Z'),
                status: BookingStatus.accepted,
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            };

            vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);
            vi.mocked(deleteZoomMeeting).mockResolvedValue(undefined);
            vi.mocked(createZoomMeeting).mockResolvedValue({
                id: 999999,
                join_url: 'https://zoom.us/j/999999',
                start_url: 'https://zoom.us/s/999999',
            });
            vi.mocked(prisma.booking.update).mockResolvedValue({} as any);

            await processRescheduleBooking('booking_123', 'old_meeting_id');

            expect(deleteZoomMeeting).toHaveBeenCalledWith('old_meeting_id');
            expect(createZoomMeeting).toHaveBeenCalled();
        });

        it('should not delete if no old meeting ID', async () => {
            const mockBooking = {
                id: 'booking_123',
                startAt: new Date(),
                endAt: new Date(Date.now() + 3600000),
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            };

            vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);
            vi.mocked(createZoomMeeting).mockResolvedValue({ id: 1, join_url: '', start_url: '' });
            vi.mocked(prisma.booking.update).mockResolvedValue({} as any);

            await processRescheduleBooking('booking_123');

            expect(deleteZoomMeeting).not.toHaveBeenCalled();
        });
    });

    describe('processExpiryCheck', () => {
        it('should find and expire stale bookings', async () => {
            const staleBooking = {
                id: 'stale_booking',
                status: BookingStatus.requested,
                expiresAt: new Date(Date.now() - 1000),
                payment: { stripePaymentIntentId: 'pi_123' },
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([staleBooking] as any);
            vi.mocked(cancelPaymentIntent).mockResolvedValue({ status: 'canceled' } as any);
            vi.mocked(expireBooking).mockResolvedValue({} as any);

            const result = await processExpiryCheck();

            expect(prisma.booking.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: BookingStatus.requested,
                    }),
                })
            );
            expect(cancelPaymentIntent).toHaveBeenCalledWith('pi_123');
            expect(expireBooking).toHaveBeenCalledWith('stale_booking');
            expect(result.count).toBe(1);
        });

        it('should handle no stale bookings', async () => {
            vi.mocked(prisma.booking.findMany).mockResolvedValue([]);

            const result = await processExpiryCheck();

            expect(result.count).toBe(0);
            expect(expireBooking).not.toHaveBeenCalled();
        });
    });

    describe('processNoShowCheck', () => {
        it('should find bookings past start time', async () => {
            vi.mocked(prisma.booking.findMany).mockResolvedValue([]);

            const result = await processNoShowCheck();

            expect(prisma.booking.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: BookingStatus.accepted,
                        attendanceOutcome: null,
                    }),
                })
            );
            expect(result.count).toBe(0);
        });

        it('should complete call when both parties joined', async () => {
            const booking = {
                id: 'both_joined',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 20 * 60 * 1000),
                candidateJoinedAt: new Date(),
                professionalJoinedAt: new Date(),
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(completeCall).mockResolvedValue({} as any);

            await processNoShowCheck();

            expect(completeCall).toHaveBeenCalledWith('both_joined', {
                attendanceOutcome: AttendanceOutcome.both_joined,
            });
        });

        it('should trigger late cancellation on candidate no-show', async () => {
            const booking = {
                id: 'cand_noshow',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 20 * 60 * 1000),
                candidateJoinedAt: null,
                professionalJoinedAt: new Date(),
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(cancelBooking).mockResolvedValue({} as any);

            await processNoShowCheck();

            expect(cancelBooking).toHaveBeenCalledWith(
                'cand_noshow',
                'system',
                expect.stringContaining('Candidate No-Show'),
                { attendanceOutcome: AttendanceOutcome.candidate_no_show }
            );
        });

        it('should initiate dispute on professional no-show', async () => {
            const booking = {
                id: 'pro_noshow',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 20 * 60 * 1000),
                candidateJoinedAt: new Date(),
                professionalJoinedAt: null,
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(initiateDispute).mockResolvedValue({} as any);

            await processNoShowCheck();

            expect(initiateDispute).toHaveBeenCalledWith(
                'pro_noshow',
                expect.objectContaining({ role: 'ADMIN' }),
                'no_show',
                expect.stringContaining('Professional')
            );
        });
    });
});
