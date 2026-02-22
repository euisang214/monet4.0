import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus, AttendanceOutcome } from '@prisma/client';

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
        $transaction: vi.fn(async (callback: any) => {
            if (typeof callback === 'function') {
                return callback({
                    auditLog: {
                        create: vi.fn(),
                    },
                });
            }
            return callback;
        }),
        booking: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
        zoomAttendanceEvent: {
            count: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            deleteMany: vi.fn(),
            create: vi.fn(),
            findMany: vi.fn(),
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

vi.mock('@/lib/integrations/stripe', () => ({
    cancelPaymentIntent: vi.fn().mockResolvedValue(undefined),
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
import { expireBooking, cancelBooking, initiateDispute, completeCall, completeIntegrations } from '@/lib/domain/bookings/transitions';
import { cancelPaymentIntent } from '@/lib/integrations/stripe';
import {
    processConfirmBooking,
    processRescheduleBooking,
    processExpiryCheck,
    processNoShowCheck,
    processZoomAttendanceEvent,
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
                candidate_join_url: 'https://zoom.us/w/cand123456',
                professional_join_url: 'https://zoom.us/w/pro123456',
                candidate_registrant_id: 'cand_reg_123456',
                professional_registrant_id: 'pro_reg_123456',
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
                candidateJoinUrl: 'https://zoom.us/w/cand123456',
                professionalJoinUrl: 'https://zoom.us/w/pro123456',
                candidateRegistrantId: 'cand_reg_123456',
                professionalRegistrantId: 'pro_reg_123456',
            });
            expect(result.processed).toBe(true);
        });

        it('should throw error if booking not found', async () => {
            vi.mocked(prisma.booking.findUnique).mockResolvedValue(null);

            await expect(processConfirmBooking('nonexistent')).rejects.toThrow('not found');
            expect(createZoomMeeting).not.toHaveBeenCalled();
        });

        it('should self-heal pending bookings with existing Zoom data', async () => {
            const mockBooking = {
                id: 'booking_123',
                startAt: new Date(),
                endAt: new Date(),
                status: BookingStatus.accepted_pending_integrations,
                zoomMeetingId: 'existing_123',
                zoomJoinUrl: 'https://zoom.us/existing',
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            };

            vi.mocked(prisma.booking.findUnique).mockResolvedValue(mockBooking as any);

            await processConfirmBooking('booking_123');

            expect(createZoomMeeting).not.toHaveBeenCalled();
            expect(completeIntegrations).toHaveBeenCalledWith('booking_123', {
                joinUrl: 'https://zoom.us/existing',
                meetingId: 'existing_123',
                candidateJoinUrl: undefined,
                professionalJoinUrl: undefined,
                candidateRegistrantId: undefined,
                professionalRegistrantId: undefined,
            });
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
                candidate_join_url: 'https://zoom.us/w/cand999999',
                professional_join_url: 'https://zoom.us/w/pro999999',
                candidate_registrant_id: 'cand_reg_999999',
                professional_registrant_id: 'pro_reg_999999',
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
            vi.mocked(createZoomMeeting).mockResolvedValue({
                id: 1,
                join_url: '',
                start_url: '',
                candidate_join_url: '',
                professional_join_url: '',
                candidate_registrant_id: 'cand_reg_1',
                professional_registrant_id: 'pro_reg_1',
            });
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
                payment: { stripePaymentIntentId: 'pi_test_123' },
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([staleBooking] as any);
            vi.mocked(expireBooking).mockResolvedValue({} as any);
            vi.mocked(cancelPaymentIntent).mockResolvedValue(undefined);

            const result = await processExpiryCheck();

            expect(prisma.booking.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: BookingStatus.requested,
                    }),
                })
            );
            expect(cancelPaymentIntent).toHaveBeenCalledWith('pi_test_123');
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
            expect(result.failedBookingIds).toEqual([]);
        });

        it('should complete call when both parties joined', async () => {
            const booking = {
                id: 'both_joined',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 20 * 60 * 1000),
                candidateId: 'cand_both_joined',
                candidateJoinedAt: new Date(),
                professionalJoinedAt: new Date(),
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(completeCall).mockResolvedValue({} as any);
            vi.mocked(prisma.zoomAttendanceEvent.count).mockResolvedValue(0);

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
                candidateId: 'cand_noshow_user',
                candidateJoinedAt: null,
                professionalJoinedAt: new Date(),
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(cancelBooking).mockResolvedValue({} as any);
            vi.mocked(prisma.zoomAttendanceEvent.count).mockResolvedValue(0);

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
                candidateId: 'cand_pro_noshow',
                candidateJoinedAt: new Date(),
                professionalJoinedAt: null,
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(initiateDispute).mockResolvedValue({} as any);
            vi.mocked(prisma.zoomAttendanceEvent.count).mockResolvedValue(0);

            await processNoShowCheck();

            expect(initiateDispute).toHaveBeenCalledWith(
                'pro_noshow',
                { userId: 'cand_pro_noshow', role: 'CANDIDATE' },
                'no_show',
                expect.stringContaining('Professional'),
                undefined,
                { attendanceOutcome: AttendanceOutcome.professional_no_show }
            );
        });

        it('should route ambiguous unknown-identity evidence to dispute at final check', async () => {
            const booking = {
                id: 'ambiguous_noshow',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 25 * 60 * 1000),
                candidateId: 'cand_ambiguous',
                candidateJoinedAt: null,
                professionalJoinedAt: null,
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(prisma.zoomAttendanceEvent.count).mockResolvedValue(1);
            vi.mocked(initiateDispute).mockResolvedValue({} as any);

            await processNoShowCheck();

            expect(initiateDispute).toHaveBeenCalledWith(
                'ambiguous_noshow',
                { userId: 'cand_ambiguous', role: 'CANDIDATE' },
                'no_show',
                expect.stringContaining('Ambiguous attendance evidence'),
                undefined,
                { attendanceOutcome: AttendanceOutcome.both_no_show }
            );
            expect(cancelBooking).not.toHaveBeenCalled();
            expect(completeCall).not.toHaveBeenCalled();
        });

        it('should not apply terminal transitions before final window', async () => {
            const booking = {
                id: 'pending_final',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 12 * 60 * 1000),
                candidateId: 'cand_pending_final',
                candidateJoinedAt: null,
                professionalJoinedAt: null,
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(prisma.zoomAttendanceEvent.count).mockResolvedValue(0);

            await processNoShowCheck();

            expect(completeCall).not.toHaveBeenCalled();
            expect(cancelBooking).not.toHaveBeenCalled();
            expect(initiateDispute).not.toHaveBeenCalled();
        });

        it('should return failed booking ids when a transition throws', async () => {
            const booking = {
                id: 'pro_noshow_failing',
                status: BookingStatus.accepted,
                startAt: new Date(Date.now() - 20 * 60 * 1000),
                candidateId: 'cand_pro_noshow_failing',
                candidateJoinedAt: new Date(),
                professionalJoinedAt: null,
            };

            vi.mocked(prisma.booking.findMany).mockResolvedValue([booking] as any);
            vi.mocked(prisma.zoomAttendanceEvent.count).mockResolvedValue(0);
            vi.mocked(initiateDispute).mockRejectedValue(new Error('forced transition failure'));

            const result = await processNoShowCheck();

            expect(result.count).toBe(1);
            expect(result.failedBookingIds).toEqual(['pro_noshow_failing']);
        });
    });

    describe('processZoomAttendanceEvent', () => {
        it('should map participant by strict email and set earliest joined timestamp', async () => {
            const eventTs = new Date('2026-02-01T10:05:00Z');
            vi.mocked(prisma.zoomAttendanceEvent.findUnique).mockResolvedValue({
                id: 'evt_1',
                meetingId: 'meeting_1',
                eventType: 'meeting.participant_joined',
                eventTs,
                payload: {
                    event: 'meeting.participant_joined',
                    event_ts: Math.floor(eventTs.getTime() / 1000),
                    payload: {
                        object: {
                            id: 'meeting_1',
                            participant: {
                                email: 'cand@test.com',
                            },
                        },
                    },
                },
                processingStatus: 'pending',
            } as any);

            vi.mocked(prisma.booking.findFirst).mockResolvedValue({
                id: 'booking_1',
                candidateJoinedAt: null,
                professionalJoinedAt: null,
                candidateZoomRegistrantId: null,
                professionalZoomRegistrantId: null,
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            } as any);
            vi.mocked(prisma.zoomAttendanceEvent.update).mockResolvedValue({} as any);

            await processZoomAttendanceEvent('evt_1');

            expect(prisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking_1' },
                data: { candidateJoinedAt: eventTs },
            });
            expect(prisma.zoomAttendanceEvent.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'evt_1' },
                    data: expect.objectContaining({
                        mappedRole: 'candidate',
                        mappingMethod: 'strict_email',
                        processingStatus: 'processed',
                    }),
                })
            );
        });

        it('should keep unknown mapping and avoid booking join timestamp updates', async () => {
            const eventTs = new Date('2026-02-01T10:07:00Z');
            vi.mocked(prisma.zoomAttendanceEvent.findUnique).mockResolvedValue({
                id: 'evt_2',
                meetingId: 'meeting_1',
                eventType: 'meeting.participant_joined',
                eventTs,
                payload: {
                    event: 'meeting.participant_joined',
                    event_ts: Math.floor(eventTs.getTime() / 1000),
                    payload: {
                        object: {
                            id: 'meeting_1',
                            participant: {
                                email: 'unknown@test.com',
                            },
                        },
                    },
                },
                processingStatus: 'pending',
            } as any);

            vi.mocked(prisma.booking.findFirst).mockResolvedValue({
                id: 'booking_1',
                candidateJoinedAt: null,
                professionalJoinedAt: null,
                candidateZoomRegistrantId: null,
                professionalZoomRegistrantId: null,
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            } as any);
            vi.mocked(prisma.zoomAttendanceEvent.update).mockResolvedValue({} as any);

            await processZoomAttendanceEvent('evt_2');

            expect(prisma.booking.update).not.toHaveBeenCalled();
            expect(prisma.zoomAttendanceEvent.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        mappedRole: 'unknown',
                        mappingMethod: 'unknown',
                    }),
                })
            );
        });

        it('should map participant by registrant id when email is unavailable', async () => {
            const eventTs = new Date('2026-02-01T10:11:00Z');
            vi.mocked(prisma.zoomAttendanceEvent.findUnique).mockResolvedValue({
                id: 'evt_3',
                meetingId: 'meeting_1',
                eventType: 'meeting.participant_joined',
                eventTs,
                payload: {
                    event: 'meeting.participant_joined',
                    event_ts: Math.floor(eventTs.getTime() / 1000),
                    payload: {
                        object: {
                            id: 'meeting_1',
                            participant: {
                                registrant_id: 'pro_reg_42',
                            },
                        },
                    },
                },
                processingStatus: 'pending',
            } as any);

            vi.mocked(prisma.booking.findFirst).mockResolvedValue({
                id: 'booking_1',
                candidateJoinedAt: null,
                professionalJoinedAt: null,
                candidateZoomRegistrantId: 'cand_reg_42',
                professionalZoomRegistrantId: 'pro_reg_42',
                candidate: { email: 'cand@test.com' },
                professional: { email: 'pro@test.com' },
            } as any);
            vi.mocked(prisma.zoomAttendanceEvent.update).mockResolvedValue({} as any);

            await processZoomAttendanceEvent('evt_3');

            expect(prisma.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking_1' },
                data: { professionalJoinedAt: eventTs },
            });
            expect(prisma.zoomAttendanceEvent.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        mappedRole: 'professional',
                        mappingMethod: 'registrant_id',
                    }),
                })
            );
        });
    });
});
