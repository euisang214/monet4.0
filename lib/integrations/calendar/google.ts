import { google } from 'googleapis';
import { prisma } from '@/lib/core/db';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.AUTH_GOOGLE_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_SECRET = process.env.AUTH_GOOGLE_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim();

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    // We don't throw error at top level to avoid crashing build if env vars missing in some contexts
    console.warn('Missing AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET (or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
}

/**
 * Setup Google OAuth2 Client
 */
export function getGoogleOAuthClient(): OAuth2Client {
    return new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        // Redirect URI - needed for auth flow, but mostly irrelevant for S2S calls
        // unless we are generating auth url.
        process.env.NEXTAUTH_URL
    );
}

/**
 * Get Authenticated Google OAuth2 Client for a User
 */
async function getAuthenticatedOAuthClient(userId: string): Promise<OAuth2Client | null> {
    const oauthAccount = await prisma.oAuthAccount.findFirst({
        where: {
            userId,
            provider: 'google',
        },
    });

    if (!oauthAccount || !oauthAccount.refreshToken) {
        console.warn(`No Google OAuth account or refresh token found for user ${userId}`);
        return null;
    }

    const oauth2Client = getGoogleOAuthClient();

    oauth2Client.setCredentials({
        access_token: oauthAccount.accessToken,
        refresh_token: oauthAccount.refreshToken,
        expiry_date: oauthAccount.expiresAt ? oauthAccount.expiresAt.getTime() : undefined,
    });

    // Listen for token updates to persist them
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
            await prisma.oAuthAccount.update({
                where: { id: oauthAccount.id },
                data: {
                    accessToken: tokens.access_token,
                    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
                    refreshToken: tokens.refresh_token ?? undefined, // Only update if new one provided
                },
            });
        }
    });

    return oauth2Client;
}

/**
 * Fetches busy times from a user's Google Calendar.
 * Automatically handles token refreshing.
 */
export async function getGoogleBusyTimes(
    userId: string,
    start: Date,
    end: Date
): Promise<{ start: Date; end: Date }[]> {
    try {
        const oauth2Client = await getAuthenticatedOAuthClient(userId);

        if (!oauth2Client) {
            return [];
        }

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                items: [{ id: 'primary' }],
            },
        });

        const busySlots = response.data.calendars?.primary?.busy;

        if (!busySlots) {
            return [];
        }

        return busySlots.map((slot) => ({
            start: new Date(slot.start!),
            end: new Date(slot.end!),
        }));

    } catch (error) {
        console.error('Error fetching Google Calendar busy times:', error);
        // Fail gracefully by returning empty (don't block app if calendar sync fails)
        return [];
    }
}
