import crypto from 'crypto';

export const ZOOM_WEBHOOK_SECRET_TOKEN = process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim();

export const ZOOM_ATTENDANCE_ENFORCEMENT = (process.env.ZOOM_ATTENDANCE_ENFORCEMENT ?? 'true') !== 'false';

function parsePositiveInt(input: string | undefined, fallback: number) {
    const parsed = Number.parseInt(input ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES = parsePositiveInt(
    process.env.ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES,
    10
);
export const ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES = parsePositiveInt(
    process.env.ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES,
    20
);
export const ZOOM_ATTENDANCE_EVENT_RETENTION_DAYS = parsePositiveInt(
    process.env.ZOOM_ATTENDANCE_EVENT_RETENTION_DAYS,
    180
);

type ZoomParticipant = {
    id?: string | number;
    user_id?: string | number;
    registrant_id?: string | number;
    email?: string;
    user_email?: string;
    name?: string;
    user_name?: string;
};

type ZoomMeetingObject = {
    id?: string | number;
    uuid?: string;
    participant?: ZoomParticipant;
};

export type ZoomWebhookBody = {
    event?: string;
    event_ts?: number | string;
    payload?: {
        plainToken?: string;
        object?: ZoomMeetingObject;
    };
};

export type ParsedZoomAttendancePayload = {
    meetingId: string | null;
    meetingUuid: string | null;
    participantId: string | null;
    participantUserId: string | null;
    participantRegistrantId: string | null;
    participantEmail: string | null;
    participantName: string | null;
    eventTs: Date;
};

export function normalizeEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
}

export function sha256Hex(value: string) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256Hex(secret: string, value: string) {
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function computeZoomWebhookDedupeKey(rawBody: string, signature: string | null, timestamp: string | null) {
    return sha256Hex([timestamp ?? '', signature ?? '', rawBody].join(':'));
}

export function computeZoomWebhookExpectedSignature(rawBody: string, timestamp: string, secretToken: string) {
    const message = `v0:${timestamp}:${rawBody}`;
    return `v0=${hmacSha256Hex(secretToken, message)}`;
}

export function timingSafeEqualHex(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyZoomWebhookSignature(rawBody: string, timestamp: string | null, signature: string | null) {
    if (!ZOOM_WEBHOOK_SECRET_TOKEN) {
        throw new Error('Missing ZOOM_WEBHOOK_SECRET_TOKEN');
    }

    if (!timestamp || !signature) return false;
    const expected = computeZoomWebhookExpectedSignature(rawBody, timestamp, ZOOM_WEBHOOK_SECRET_TOKEN);
    return timingSafeEqualHex(expected, signature);
}

export function computeZoomValidationEncryptedToken(plainToken: string) {
    if (!ZOOM_WEBHOOK_SECRET_TOKEN) {
        throw new Error('Missing ZOOM_WEBHOOK_SECRET_TOKEN');
    }

    return hmacSha256Hex(ZOOM_WEBHOOK_SECRET_TOKEN, plainToken);
}

function readEventTimestamp(rawTs: number | string | undefined) {
    if (rawTs === undefined || rawTs === null) return new Date();
    const numericTs = typeof rawTs === 'string' ? Number(rawTs) : rawTs;
    if (!Number.isFinite(numericTs)) return new Date();
    // Zoom event_ts can appear in either seconds or milliseconds depending on source.
    const epochMs = numericTs > 100_000_000_000 ? numericTs : numericTs * 1000;
    return new Date(epochMs);
}

function pickFirstString(...values: Array<string | number | undefined>) {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const normalized = String(value).trim();
        if (normalized.length > 0) return normalized;
    }
    return null;
}

export function parseZoomAttendancePayload(body: ZoomWebhookBody): ParsedZoomAttendancePayload {
    const object = body.payload?.object;
    const participant = object?.participant;

    return {
        meetingId: pickFirstString(object?.id),
        meetingUuid: pickFirstString(object?.uuid),
        participantId: pickFirstString(participant?.id),
        participantUserId: pickFirstString(participant?.user_id),
        participantRegistrantId: pickFirstString(participant?.registrant_id),
        participantEmail: normalizeEmail(
            pickFirstString(participant?.email, participant?.user_email)
        ),
        participantName: pickFirstString(participant?.name, participant?.user_name),
        eventTs: readEventTimestamp(body.event_ts),
    };
}

export function isZoomParticipantJoinedEvent(eventType: string | null | undefined) {
    return eventType === 'meeting.participant_joined';
}

export function isZoomParticipantLeftEvent(eventType: string | null | undefined) {
    return eventType === 'meeting.participant_left';
}
