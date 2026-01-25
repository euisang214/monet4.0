import { prisma } from '@/lib/core/db';

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID;
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID;
const ZOOM_CLIENT_SECRET = process.env.ZOOM_CLIENT_SECRET;

if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    console.warn('Missing Zoom credentials');
}

// In-memory token cache
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get Zoom Server-to-Server OAuth Token
 * Caches token until 5 minutes before expiration
 */
export async function getZoomAccessToken(): Promise<string> {
    if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
        throw new Error('Missing Zoom credentials');
    }

    // Return cached token if still valid (with 5 min buffer)
    if (cachedToken && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
        return cachedToken;
    }

    const auth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    try {
        const response = await fetch(
            `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${auth}`,
                },
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Zoom Auth Failed: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        cachedToken = data.access_token;
        // expires_in is in seconds
        tokenExpiresAt = Date.now() + data.expires_in * 1000;

        return cachedToken!;
    } catch (error) {
        console.error('Error fetching Zoom token:', error);
        throw error;
    }
}

interface CreateMeetingParams {
    topic: string;
    start_time: Date; // Should be ISO string actually, but Date object is safer to pass in
    duration: number; // minutes
    timezone?: string;
    agenda?: string;
}

interface ZoomMeetingResponse {
    id: number;
    join_url: string;
    start_url: string;
    password?: string;
}

/**
 * Create a Zoom Meeting
 */
export async function createZoomMeeting({
    topic,
    start_time,
    duration,
    timezone = 'UTC',
    agenda,
}: CreateMeetingParams): Promise<ZoomMeetingResponse> {
    const token = await getZoomAccessToken();

    try {
        // Zoom API requires ISO 8601 format: yyyy-MM-ddTHH:mm:ssZ
        // But for 'start_time', if timezone is specified, it should be local time "yyyy-MM-ddTHH:mm:ss" 
        // or just pass UTC ISO string and let Zoom handle it.
        // Safest is usually passing UTC time and 'UTC' as timezone.

        // Note: Zoom recommends "yyyy-MM-ddTHH:mm:ss" format if timezone is provided.
        const startTimeStr = start_time.toISOString().split('.')[0] + 'Z';

        const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                topic,
                type: 2, // Scheduled meeting
                start_time: startTimeStr,
                duration,
                timezone: 'UTC', // Enforce UTC to avoid ambiguity
                agenda,
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: true,
                    mute_upon_entry: false,
                    waiting_room: false,
                    auto_recording: 'none',
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Zoom Create Meeting Failed: ${JSON.stringify(error)}`);
        }

        const data = await response.json();

        return {
            id: data.id,
            join_url: data.join_url,
            start_url: data.start_url,
            password: data.password,
        };
    } catch (error) {
        console.error('Error creating Zoom meeting:', error);
        throw error;
    }
}
/**
 * Delete a Zoom Meeting
 */
export async function deleteZoomMeeting(meetingId: string): Promise<void> {
    const token = await getZoomAccessToken();

    try {
        const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            // If 404, consider it already deleted (idempotent)
            if (response.status === 404) return;

            const error = await response.json();
            throw new Error(`Zoom Delete Meeting Failed: ${JSON.stringify(error)}`);
        }
    } catch (error) {
        console.error('Error deleting Zoom meeting:', error);
        throw error;
    }
}
