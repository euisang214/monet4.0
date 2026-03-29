import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisputeReason } from '@prisma/client';
import {
    cancelCandidateBooking,
    createCandidateBookingRequest,
    submitCandidateDispute,
    submitCandidateRescheduleRequest,
    submitCandidateReview,
} from '@/components/bookings/services/candidateBookingApi';
import {
    cancelProfessionalUpcomingBooking,
    confirmProfessionalBooking,
    rejectProfessionalRequest,
    requestProfessionalReschedule,
    submitProfessionalFeedback,
} from '@/components/bookings/services/professionalBookingApi';
import {
    confirmProfessionalReschedule,
    rejectProfessionalReschedule,
} from '@/components/bookings/services/professionalRescheduleApi';
import {
    confirmVerificationCode,
    requestVerificationCode,
} from '@/components/auth/services/verificationApi';
import {
    resolveAdminDispute,
    updateAdminZoomLinks,
} from '@/components/admin/services/adminMutationApi';

const fetchMock = vi.fn();

function jsonResponse(payload: unknown, ok = true) {
    return {
        ok,
        json: vi.fn().mockResolvedValue(payload),
    } as unknown as Response;
}

describe('tracked action service modules', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.fetch = fetchMock as unknown as typeof fetch;
    });

    it('creates candidate booking requests from normalized API responses', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({
            data: {
                bookingId: 'booking-1',
                clientSecret: 'pi_secret_1',
            },
        }));

        await expect(
            createCandidateBookingRequest({
                professionalId: 'pro-1',
                availabilitySlots: [],
                timezone: 'America/New_York',
            }),
        ).resolves.toEqual({
            bookingId: 'booking-1',
            clientSecret: 'pi_secret_1',
        });
    });

    it('normalizes candidate cancel, review, dispute, and reschedule errors', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ error: 'cancel failed' }, false))
            .mockResolvedValueOnce(jsonResponse({ error: 'review failed' }, false))
            .mockResolvedValueOnce(jsonResponse({ error: 'dispute failed' }, false))
            .mockResolvedValueOnce(jsonResponse({ error: 'reschedule failed' }, false));

        await expect(cancelCandidateBooking({ bookingId: 'booking-1' })).rejects.toThrow('cancel failed');
        await expect(
            submitCandidateReview({
                bookingId: 'booking-1',
                rating: 5,
                text: 'Great session',
                timezone: 'America/New_York',
            }),
        ).rejects.toThrow('review failed');
        await expect(
            submitCandidateDispute({
                bookingId: 'booking-1',
                reason: 'other' as DisputeReason,
                description: 'Issue details',
            }),
        ).rejects.toThrow('dispute failed');
        await expect(
            submitCandidateRescheduleRequest({
                bookingId: 'booking-1',
                slots: [],
                reason: 'Conflict',
                timezone: 'America/New_York',
            }),
        ).rejects.toThrow('reschedule failed');
    });

    it('normalizes professional booking service success and failure states', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({}))
            .mockResolvedValueOnce(jsonResponse({ error: 'reject failed' }, false));

        await expect(confirmProfessionalBooking({ bookingId: 'booking-1', startAt: '2026-03-01T15:00:00.000Z' })).resolves.toBeUndefined();
        await expect(cancelProfessionalUpcomingBooking({ bookingId: 'booking-1' })).resolves.toBeUndefined();
        await expect(requestProfessionalReschedule({ bookingId: 'booking-1' })).resolves.toBeUndefined();
        await expect(confirmProfessionalReschedule('booking-1', '2026-03-01T15:00:00.000Z')).resolves.toBeUndefined();
        await expect(rejectProfessionalReschedule('booking-1')).resolves.toBeUndefined();
        await expect(
            submitProfessionalFeedback({
                bookingId: 'booking-1',
                text: 'Good session',
                actions: ['A', 'B', 'C'],
                contentRating: 5,
                deliveryRating: 5,
                valueRating: 5,
            }),
        ).resolves.toBeUndefined();
        await expect(
            rejectProfessionalRequest({
                bookingId: 'booking-1',
                isReschedule: false,
            }),
        ).resolves.toBeUndefined();
        await expect(
            rejectProfessionalRequest({
                bookingId: 'booking-2',
                isReschedule: true,
            }),
        ).rejects.toThrow('reject failed');
    });

    it('normalizes verification request and confirmation errors', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({}, false))
            .mockResolvedValueOnce(jsonResponse({ error: 'invalid token' }, false));

        await expect(requestVerificationCode('pro@example.com')).rejects.toThrow('Failed to send verification email.');
        await expect(confirmVerificationCode('123456')).rejects.toThrow('invalid token');
    });

    it('normalizes admin dispute and zoom-link mutation errors', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ error: 'dispute failed' }, false))
            .mockResolvedValueOnce(jsonResponse({ error: 'zoom failed' }, false));

        await expect(
            resolveAdminDispute({
                disputeId: 'dispute-1',
                action: 'dismiss',
                resolution: 'Dismissed.',
            }),
        ).rejects.toThrow('dispute failed');

        await expect(
            updateAdminZoomLinks({
                bookingId: 'booking-1',
                zoomJoinUrl: 'https://zoom.example.com/j/123',
            }),
        ).rejects.toThrow('zoom failed');
    });
});
