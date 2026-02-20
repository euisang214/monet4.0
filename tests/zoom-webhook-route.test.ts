import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'crypto';

const zoomAttendanceEventCreateMock = vi.hoisted(() => vi.fn());
const zoomAttendanceEventFindUniqueMock = vi.hoisted(() => vi.fn());
const bookingsQueueAddMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/core/db', () => ({
    prisma: {
        zoomAttendanceEvent: {
            create: zoomAttendanceEventCreateMock,
            findUnique: zoomAttendanceEventFindUniqueMock,
        },
    },
}));

vi.mock('@/lib/queues', () => ({
    bookingsQueue: {
        add: bookingsQueueAddMock,
    },
}));

function signZoomPayload(payload: string, timestamp: string, secret: string) {
    const digest = crypto
        .createHmac('sha256', secret)
        .update(`v0:${timestamp}:${payload}`)
        .digest('hex');
    return `v0=${digest}`;
}

describe('POST /api/shared/zoom/webhook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    it('accepts a valid participant event and enqueues processing', async () => {
        vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', 'zoom_secret_test');
        zoomAttendanceEventCreateMock.mockResolvedValue({ id: 'zae_1' });
        zoomAttendanceEventFindUniqueMock.mockReset();
        bookingsQueueAddMock.mockResolvedValue({});

        const payloadObject = {
            event: 'meeting.participant_joined',
            event_ts: 1_700_000_000,
            payload: {
                object: {
                    id: '123456',
                    uuid: 'meeting_uuid',
                    participant: {
                        email: 'candidate@test.com',
                        name: 'Candidate',
                    },
                },
            },
        };
        const body = JSON.stringify(payloadObject);
        const timestamp = `${Math.floor(Date.now() / 1000)}`;
        const signature = signZoomPayload(body, timestamp, 'zoom_secret_test');

        const { POST } = await import('@/app/api/shared/zoom/webhook/route');
        const response = await POST(new Request('http://localhost/api/shared/zoom/webhook', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zm-request-timestamp': timestamp,
                'x-zm-signature': signature,
            },
            body,
        }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ received: true });
        expect(zoomAttendanceEventCreateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    eventType: 'meeting.participant_joined',
                    meetingId: '123456',
                }),
            })
        );
        expect(bookingsQueueAddMock).toHaveBeenCalledWith(
            'zoom-attendance-event',
            { zoomAttendanceEventId: 'zae_1' },
            expect.objectContaining({
                jobId: 'zoom-attendance-event:zae_1',
            })
        );
    });

    it('rejects invalid signatures', async () => {
        vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', 'zoom_secret_test');
        const body = JSON.stringify({ event: 'meeting.participant_joined' });
        zoomAttendanceEventFindUniqueMock.mockReset();

        const { POST } = await import('@/app/api/shared/zoom/webhook/route');
        const response = await POST(new Request('http://localhost/api/shared/zoom/webhook', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zm-request-timestamp': `${Math.floor(Date.now() / 1000)}`,
                'x-zm-signature': 'v0=bad_signature',
            },
            body,
        }));
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({ error: 'invalid_signature' });
        expect(zoomAttendanceEventCreateMock).not.toHaveBeenCalled();
    });

    it('handles endpoint validation challenge', async () => {
        vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', 'zoom_secret_test');
        const bodyObject = {
            event: 'endpoint.url_validation',
            payload: {
                plainToken: 'plain_token_test',
            },
        };
        const body = JSON.stringify(bodyObject);
        zoomAttendanceEventFindUniqueMock.mockReset();
        const timestamp = `${Math.floor(Date.now() / 1000)}`;
        const signature = signZoomPayload(body, timestamp, 'zoom_secret_test');

        const { POST } = await import('@/app/api/shared/zoom/webhook/route');
        const response = await POST(new Request('http://localhost/api/shared/zoom/webhook', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zm-request-timestamp': timestamp,
                'x-zm-signature': signature,
            },
            body,
        }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.plainToken).toBe('plain_token_test');
        expect(typeof json.encryptedToken).toBe('string');
        expect(zoomAttendanceEventCreateMock).not.toHaveBeenCalled();
    });

    it('rejects malformed endpoint validation challenge payloads', async () => {
        vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', 'zoom_secret_test');
        const bodyObject = {
            event: 'endpoint.url_validation',
            payload: {},
        };
        const body = JSON.stringify(bodyObject);
        const timestamp = `${Math.floor(Date.now() / 1000)}`;
        const signature = signZoomPayload(body, timestamp, 'zoom_secret_test');

        const { POST } = await import('@/app/api/shared/zoom/webhook/route');
        const response = await POST(new Request('http://localhost/api/shared/zoom/webhook', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zm-request-timestamp': timestamp,
                'x-zm-signature': signature,
            },
            body,
        }));
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({ error: 'missing_plain_token' });
    });

    it('returns duplicate acknowledgment on unique key collisions', async () => {
        vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', 'zoom_secret_test');
        zoomAttendanceEventCreateMock.mockRejectedValue({ code: 'P2002' });
        zoomAttendanceEventFindUniqueMock.mockResolvedValue({
            id: 'zae_duplicate_1',
            processingStatus: 'processed',
        });

        const bodyObject = {
            event: 'meeting.participant_left',
            payload: {
                object: {
                    id: '123456',
                },
            },
        };
        const body = JSON.stringify(bodyObject);
        const timestamp = `${Math.floor(Date.now() / 1000)}`;
        const signature = signZoomPayload(body, timestamp, 'zoom_secret_test');

        const { POST } = await import('@/app/api/shared/zoom/webhook/route');
        const response = await POST(new Request('http://localhost/api/shared/zoom/webhook', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zm-request-timestamp': timestamp,
                'x-zm-signature': signature,
            },
            body,
        }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ received: true, duplicate: true });
        expect(bookingsQueueAddMock).not.toHaveBeenCalled();
    });

    it('re-enqueues duplicate events that are not processed yet', async () => {
        vi.stubEnv('ZOOM_WEBHOOK_SECRET_TOKEN', 'zoom_secret_test');
        zoomAttendanceEventCreateMock.mockRejectedValue({ code: 'P2002' });
        zoomAttendanceEventFindUniqueMock.mockResolvedValue({
            id: 'zae_duplicate_pending',
            processingStatus: 'pending',
        });
        bookingsQueueAddMock.mockResolvedValue({});

        const bodyObject = {
            event: 'meeting.participant_joined',
            payload: {
                object: {
                    id: '123456',
                },
            },
        };
        const body = JSON.stringify(bodyObject);
        const timestamp = `${Math.floor(Date.now() / 1000)}`;
        const signature = signZoomPayload(body, timestamp, 'zoom_secret_test');

        const { POST } = await import('@/app/api/shared/zoom/webhook/route');
        const response = await POST(new Request('http://localhost/api/shared/zoom/webhook', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-zm-request-timestamp': timestamp,
                'x-zm-signature': signature,
            },
            body,
        }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({ received: true, duplicate: true });
        expect(bookingsQueueAddMock).toHaveBeenCalledWith(
            'zoom-attendance-event',
            { zoomAttendanceEventId: 'zae_duplicate_pending' },
            expect.objectContaining({
                jobId: 'zoom-attendance-event:zae_duplicate_pending',
            })
        );
    });
});
