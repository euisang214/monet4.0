import { prisma } from '@/lib/core/db';
import { bookingsQueue } from '@/lib/queues';
import {
    computeZoomValidationEncryptedToken,
    computeZoomWebhookDedupeKey,
    isZoomParticipantJoinedEvent,
    isZoomParticipantLeftEvent,
    parseZoomAttendancePayload,
    verifyZoomWebhookSignature,
    type ZoomWebhookBody,
} from '@/lib/integrations/zoom-attendance';
import { Prisma } from '@prisma/client';

function isZoomAttendanceEvent(eventType: string | undefined) {
    return isZoomParticipantJoinedEvent(eventType) || isZoomParticipantLeftEvent(eventType);
}

function jsonError(status: number, error: string) {
    return Response.json({ error }, { status });
}

export async function POST(request: Request) {
    const rawBody = await request.text();
    const signature = request.headers.get('x-zm-signature');
    const requestTimestamp = request.headers.get('x-zm-request-timestamp');

    let body: ZoomWebhookBody;
    try {
        body = JSON.parse(rawBody) as ZoomWebhookBody;
    } catch {
        return jsonError(400, 'invalid_json');
    }

    try {
        const isValidSignature = verifyZoomWebhookSignature(rawBody, requestTimestamp, signature);
        if (!isValidSignature) {
            return jsonError(400, 'invalid_signature');
        }
    } catch (error) {
        console.error('[ZOOM WEBHOOK] Signature verification failed:', error);
        return jsonError(500, 'signature_verification_error');
    }

    if (body.event === 'endpoint.url_validation') {
        const plainToken = body.payload?.plainToken;
        if (!plainToken) {
            return jsonError(400, 'missing_plain_token');
        }

        const encryptedToken = computeZoomValidationEncryptedToken(plainToken);
        return Response.json({ plainToken, encryptedToken });
    }

    const eventType = body.event;
    if (!eventType || !isZoomAttendanceEvent(eventType)) {
        return Response.json({ received: true, ignored: true });
    }

    const parsedPayload = parseZoomAttendancePayload(body);
    if (!parsedPayload.meetingId) {
        return jsonError(400, 'missing_meeting_id');
    }

    const dedupeKey = computeZoomWebhookDedupeKey(rawBody, signature, requestTimestamp);

    let attendanceEvent: { id: string; processingStatus: string } | null = null;
    let wasDuplicate = false;

    try {
        attendanceEvent = await prisma.zoomAttendanceEvent.create({
            data: {
                dedupeKey,
                eventType,
                eventTs: parsedPayload.eventTs,
                meetingId: parsedPayload.meetingId,
                meetingUuid: parsedPayload.meetingUuid,
                participantId: parsedPayload.participantId,
                participantUserId: parsedPayload.participantUserId,
                participantEmail: parsedPayload.participantEmail,
                participantName: parsedPayload.participantName,
                payload: body as unknown as Prisma.InputJsonValue,
                processingStatus: 'pending',
            },
            select: {
                id: true,
                processingStatus: true,
            },
        });
    } catch (error) {
        const isUniqueConstraintViolation = (
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
        ) || (
            typeof error === 'object'
            && error !== null
            && 'code' in error
            && (error as { code?: string }).code === 'P2002'
        );

        if (isUniqueConstraintViolation) {
            wasDuplicate = true;
            attendanceEvent = await prisma.zoomAttendanceEvent.findUnique({
                where: { dedupeKey },
                select: {
                    id: true,
                    processingStatus: true,
                },
            });

            if (!attendanceEvent) {
                return Response.json({ received: true, duplicate: true });
            }
        } else {
            console.error('[ZOOM WEBHOOK] Failed to persist event:', error);
            return jsonError(500, 'webhook_processing_error');
        }
    }

    if (!attendanceEvent) {
        return jsonError(500, 'webhook_processing_error');
    }

    const shouldEnqueue = attendanceEvent.processingStatus !== 'processed';
    if (!shouldEnqueue) {
        return Response.json({ received: true, duplicate: true });
    }

    try {
        await bookingsQueue.add(
            'zoom-attendance-event',
            { zoomAttendanceEventId: attendanceEvent.id },
            {
                jobId: `zoom-attendance-event:${attendanceEvent.id}`,
                removeOnComplete: true,
                removeOnFail: false,
            }
        );
    } catch (error) {
        console.error('[ZOOM WEBHOOK] Failed to enqueue event:', error);
        return jsonError(500, 'webhook_processing_error');
    }

    return Response.json({ received: true, ...(wasDuplicate ? { duplicate: true } : {}) });
}
