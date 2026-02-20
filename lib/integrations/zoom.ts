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
    start_time: Date;
    duration: number;
    timezone?: string;
    agenda?: string;
    candidateEmail: string;
    professionalEmail: string;
    candidateName?: string | null;
    professionalName?: string | null;
}

interface ZoomMeetingResponse {
    id: number;
    join_url: string;
    start_url: string;
    password?: string;
    candidate_join_url: string;
    professional_join_url: string;
    candidate_registrant_id: string;
    professional_registrant_id: string;
}

interface ZoomRegistrantResponse {
    id?: string;
    join_url?: string;
}

function splitName(fullName: string | null | undefined) {
    const trimmed = fullName?.trim();
    if (!trimmed) {
        return { firstName: 'Participant', lastName: 'Monet' };
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'Monet' };
    }

    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
    };
}

async function createRegistrant({
    meetingId,
    token,
    email,
    name,
}: {
    meetingId: number;
    token: string;
    email: string;
    name?: string | null;
}) {
    const { firstName, lastName } = splitName(name);
    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            first_name: firstName,
            last_name: lastName,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Zoom Create Registrant Failed: ${JSON.stringify(error)}`);
    }

    const registrant = await response.json() as ZoomRegistrantResponse;
    if (!registrant.join_url || !registrant.id) {
        throw new Error('Zoom registrant response missing join_url or id');
    }

    return {
        joinUrl: registrant.join_url,
        registrantId: registrant.id,
    };
}

/**
 * Create a Zoom Meeting
 */
export async function createZoomMeeting({
    topic,
    start_time,
    duration,
    timezone,
    agenda,
    candidateEmail,
    professionalEmail,
    candidateName,
    professionalName,
}: CreateMeetingParams): Promise<ZoomMeetingResponse> {
    const token = await getZoomAccessToken();

    try {
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
                timezone: timezone || 'UTC',
                agenda,
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: true,
                    mute_upon_entry: false,
                    waiting_room: false,
                    auto_recording: 'none',
                    approval_type: 0, // Auto-approve registrants
                    registration_type: 1, // Register once and attend all occurrences
                },
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Zoom Create Meeting Failed: ${JSON.stringify(error)}`);
        }

        const data = await response.json();
        const meetingId = data.id as number;

        const candidateRegistrant = await createRegistrant({
            meetingId,
            token,
            email: candidateEmail,
            name: candidateName,
        });

        const professionalRegistrant = await createRegistrant({
            meetingId,
            token,
            email: professionalEmail,
            name: professionalName,
        });

        return {
            id: meetingId,
            join_url: data.join_url,
            start_url: data.start_url,
            password: data.password,
            candidate_join_url: candidateRegistrant.joinUrl,
            professional_join_url: professionalRegistrant.joinUrl,
            candidate_registrant_id: candidateRegistrant.registrantId,
            professional_registrant_id: professionalRegistrant.registrantId,
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
