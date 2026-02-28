import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingStatus } from '@prisma/client';

const bookingFindUniqueMock = vi.hoisted(() => vi.fn());
const bookingUpdateMock = vi.hoisted(() => vi.fn());
const sendCalendarInviteRequestEmailMock = vi.hoisted(() => vi.fn());
const sendCalendarInviteCancelEmailMock = vi.hoisted(() => vi.fn());
const getZoomInvitationContentMock = vi.hoisted(() => vi.fn());
const notificationsQueueAddMock = vi.hoisted(() => vi.fn());
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

vi.mock('@/lib/queues', () => ({
    notificationsQueue: {
        add: notificationsQueueAddMock,
    },
}));

vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: {
            findUnique: bookingFindUniqueMock,
            update: bookingUpdateMock,
        },
        payout: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock('@/lib/integrations/zoom', () => ({
    getZoomInvitationContent: getZoomInvitationContentMock,
}));

vi.mock('@/lib/integrations/email', () => ({
    sendFeedbackRevisionEmail: vi.fn(),
    sendBookingRequestedEmail: vi.fn(),
    sendBookingDeclinedEmail: vi.fn(),
    sendPayoutReleasedEmail: vi.fn(),
    sendCalendarInviteRequestEmail: sendCalendarInviteRequestEmailMock,
    sendCalendarInviteCancelEmail: sendCalendarInviteCancelEmailMock,
}));

function getAcceptedBooking(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        id: 'booking_accepted_1',
        status: BookingStatus.accepted,
        zoomMeetingId: '123456',
        zoomJoinUrl: 'https://zoom.us/j/123456',
        candidateZoomJoinUrl: 'https://zoom.us/w/candidate123',
        professionalZoomJoinUrl: 'https://zoom.us/w/pro123',
        candidateCalendarInviteUid: null,
        professionalCalendarInviteUid: null,
        candidateCalendarInviteSequence: 0,
        professionalCalendarInviteSequence: 0,
        candidateCalendarInviteSentAt: null,
        professionalCalendarInviteSentAt: null,
        candidateCalendarInviteCancelledAt: null,
        professionalCalendarInviteCancelledAt: null,
        startAt: new Date('2026-02-22T10:00:00Z'),
        endAt: new Date('2026-02-22T10:30:00Z'),
        candidate: { email: 'cand@example.com', firstName: 'Cand', lastName: 'One' },
        professional: { email: 'pro@example.com', firstName: 'Pro', lastName: 'Two' },
        ...overrides,
    };
}

function getCancelledBooking() {
    return getAcceptedBooking({
        status: BookingStatus.cancelled,
        candidateCalendarInviteUid: 'booking_accepted_1.candidate@monet.ai',
        candidateCalendarInviteSequence: 2,
    });
}

async function runCapturedProcessor(jobData: Record<string, unknown>) {
    if (!capturedProcessorRef.processor) {
        throw new Error('Expected notifications worker processor to be captured');
    }

    return capturedProcessorRef.processor({
        id: 'job_1',
        name: 'notifications',
        data: jobData,
    });
}

async function initializeWorker() {
    const { createNotificationsWorker } = await import('@/lib/queues/notifications');
    createNotificationsWorker({} as any);
}

describe('Notifications worker calendar invite semantics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        capturedProcessorRef.processor = null;
        getZoomInvitationContentMock.mockResolvedValue({ text: 'Join Zoom Meeting\nhttps://zoom.us/w/candidate123' });
        bookingUpdateMock.mockResolvedValue({});
    });

    it('fans out booking_accepted to per-recipient calendar_invite_request jobs', async () => {
        await initializeWorker();
        bookingFindUniqueMock.mockResolvedValue(getAcceptedBooking());

        await expect(runCapturedProcessor({
            type: 'booking_accepted',
            bookingId: 'booking_accepted_1',
        })).resolves.toEqual({ processed: true });

        expect(notificationsQueueAddMock).toHaveBeenCalledTimes(2);
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_request',
                bookingId: 'booking_accepted_1',
                recipientRole: 'CANDIDATE',
                revisionKey: '123456',
            },
            {
                jobId: 'cal-req-booking_accepted_1-CANDIDATE-123456',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        expect(notificationsQueueAddMock).toHaveBeenCalledWith(
            'notifications',
            {
                type: 'calendar_invite_request',
                bookingId: 'booking_accepted_1',
                recipientRole: 'PROFESSIONAL',
                revisionKey: '123456',
            },
            {
                jobId: 'cal-req-booking_accepted_1-PROFESSIONAL-123456',
                attempts: 5,
                backoff: { type: 'exponential', delay: 60_000 },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
    });

    it('processes calendar_invite_request and persists candidate UID/sequence state', async () => {
        await initializeWorker();
        bookingFindUniqueMock.mockResolvedValue(getAcceptedBooking());

        await expect(runCapturedProcessor({
            type: 'calendar_invite_request',
            bookingId: 'booking_accepted_1',
            recipientRole: 'CANDIDATE',
            revisionKey: '123456',
        })).resolves.toEqual({ processed: true });

        expect(sendCalendarInviteRequestEmailMock).toHaveBeenCalledWith(
            expect.any(Object),
            'CANDIDATE',
            'booking_accepted_1.candidate@monet.ai',
            0,
            expect.stringContaining('Join Zoom Meeting'),
        );
        expect(bookingUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'booking_accepted_1' },
                data: expect.objectContaining({
                    candidateCalendarInviteUid: 'booking_accepted_1.candidate@monet.ai',
                    candidateCalendarInviteSequence: 0,
                    candidateCalendarInviteCancelledAt: null,
                }),
            }),
        );
    });

    it('sends updated request invite when invite state already exists for same revision', async () => {
        await initializeWorker();
        bookingFindUniqueMock.mockResolvedValue(getAcceptedBooking({
            candidateCalendarInviteUid: 'booking_accepted_1.candidate@monet.ai',
            candidateCalendarInviteSequence: 2,
            candidateCalendarInviteSentAt: new Date('2026-02-22T09:00:00Z'),
        }));

        await expect(runCapturedProcessor({
            type: 'calendar_invite_request',
            bookingId: 'booking_accepted_1',
            recipientRole: 'CANDIDATE',
            revisionKey: '123456',
        })).resolves.toEqual({ processed: true });

        expect(sendCalendarInviteRequestEmailMock).toHaveBeenCalledWith(
            expect.any(Object),
            'CANDIDATE',
            'booking_accepted_1.candidate@monet.ai',
            3,
            expect.any(String),
        );
        expect(bookingUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'booking_accepted_1' },
                data: expect.objectContaining({
                    candidateCalendarInviteSequence: 3,
                }),
            }),
        );
    });

    it('skips stale request jobs where revision key does not match booking meeting id', async () => {
        await initializeWorker();
        bookingFindUniqueMock.mockResolvedValue(getAcceptedBooking({
            zoomMeetingId: 'new-revision',
        }));

        await expect(runCapturedProcessor({
            type: 'calendar_invite_request',
            bookingId: 'booking_accepted_1',
            recipientRole: 'CANDIDATE',
            revisionKey: 'old-revision',
        })).resolves.toEqual({ processed: true });

        expect(sendCalendarInviteRequestEmailMock).not.toHaveBeenCalled();
        expect(bookingUpdateMock).not.toHaveBeenCalled();
    });

    it('processes calendar_invite_cancel with incremented sequence for candidate role', async () => {
        await initializeWorker();
        bookingFindUniqueMock.mockResolvedValue(getCancelledBooking());

        await expect(runCapturedProcessor({
            type: 'calendar_invite_cancel',
            bookingId: 'booking_accepted_1',
            recipientRole: 'CANDIDATE',
        })).resolves.toEqual({ processed: true });

        expect(sendCalendarInviteCancelEmailMock).toHaveBeenCalledWith(
            expect.any(Object),
            'CANDIDATE',
            'booking_accepted_1.candidate@monet.ai',
            3,
            expect.stringContaining('Join Zoom Meeting'),
        );
        expect(bookingUpdateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'booking_accepted_1' },
                data: expect.objectContaining({
                    candidateCalendarInviteSequence: 3,
                    candidateCalendarInviteCancelledAt: expect.any(Date),
                }),
            }),
        );
    });
});
