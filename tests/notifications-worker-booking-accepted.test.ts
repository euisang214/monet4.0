import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

const bookingFindUniqueMock = vi.hoisted(() => vi.fn());
const sendBookingAcceptedEmailMock = vi.hoisted(() => vi.fn());
const capturedProcessorRef = vi.hoisted(() => ({
    processor: null as ((job: any) => Promise<any>) | null,
}));
const workerOnMock = vi.hoisted(() => vi.fn());
const workerCloseMock = vi.hoisted(() => vi.fn());
const workerConstructorMock = vi.hoisted(() =>
    vi.fn(function WorkerMock(this: unknown, _queueName: string, processor: (job: any) => Promise<any>) {
        capturedProcessorRef.processor = processor;
        return {
            on: workerOnMock,
            close: workerCloseMock,
        };
    })
);

vi.mock('bullmq', () => ({
    Worker: workerConstructorMock,
}));

vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: {
            findUnique: bookingFindUniqueMock,
        },
        payout: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('@/lib/integrations/email', () => ({
    sendFeedbackRevisionEmail: vi.fn(),
    sendBookingRequestedEmail: vi.fn(),
    sendBookingAcceptedEmail: sendBookingAcceptedEmailMock,
    sendBookingDeclinedEmail: vi.fn(),
    sendPayoutReleasedEmail: vi.fn(),
}));

import { createNotificationsWorker } from '@/lib/queues/notifications';

function getAcceptedBooking() {
    return {
        id: 'booking_accepted_1',
        status: BookingStatus.accepted,
        zoomJoinUrl: 'https://zoom.us/j/123456',
        candidateZoomJoinUrl: null,
        professionalZoomJoinUrl: null,
        candidate: { email: 'cand@example.com' },
        professional: { email: 'pro@example.com' },
    };
}

function getAcceptedJob() {
    return {
        id: 'job_1',
        name: 'notifications',
        data: {
            type: 'booking_accepted',
            bookingId: 'booking_accepted_1',
        },
    };
}

async function runCapturedProcessor() {
    if (!capturedProcessorRef.processor) {
        throw new Error('Expected notifications worker processor to be captured');
    }

    return capturedProcessorRef.processor(getAcceptedJob());
}

describe('Notifications worker booking_accepted best-effort semantics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedProcessorRef.processor = null;
        createNotificationsWorker({} as any);
        bookingFindUniqueMock.mockResolvedValue(getAcceptedBooking());
    });

    it('does not throw when candidate email fails and professional email succeeds', async () => {
        sendBookingAcceptedEmailMock.mockImplementation(async (_booking: any, role: 'CANDIDATE' | 'PROFESSIONAL') => {
            if (role === 'CANDIDATE') {
                throw new Error('candidate send failed');
            }
        });

        await expect(runCapturedProcessor()).resolves.toEqual({ processed: true });
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledTimes(2);
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledWith(expect.any(Object), 'CANDIDATE');
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledWith(expect.any(Object), 'PROFESSIONAL');
    });

    it('does not throw when professional email fails and candidate email succeeds', async () => {
        sendBookingAcceptedEmailMock.mockImplementation(async (_booking: any, role: 'CANDIDATE' | 'PROFESSIONAL') => {
            if (role === 'PROFESSIONAL') {
                throw new Error('professional send failed');
            }
        });

        await expect(runCapturedProcessor()).resolves.toEqual({ processed: true });
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledTimes(2);
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledWith(expect.any(Object), 'CANDIDATE');
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledWith(expect.any(Object), 'PROFESSIONAL');
    });

    it('throws when both candidate and professional emails fail', async () => {
        sendBookingAcceptedEmailMock.mockImplementation(async () => {
            throw new Error('send failed');
        });

        await expect(runCapturedProcessor()).rejects.toThrow(
            'Both booking acceptance emails failed for booking booking_accepted_1'
        );
        expect(sendBookingAcceptedEmailMock).toHaveBeenCalledTimes(2);
    });
});
