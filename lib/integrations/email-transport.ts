import nodemailer from "nodemailer";
import { google } from "googleapis";

export interface TransactionalEmailAttachment {
    filename: string;
    content: string | Buffer;
    contentType?: string;
}

export interface TransactionalEmailCalendarEvent {
    method: "PUBLISH" | "REQUEST" | "CANCEL";
    content: string | Buffer;
    filename?: string;
}

export interface TransactionalEmailMessage {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: TransactionalEmailAttachment[];
    icalEvent?: TransactionalEmailCalendarEvent;
}

const GMAIL_OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
const GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
const GMAIL_OAUTH_REFRESH_TOKEN = process.env.GMAIL_OAUTH_REFRESH_TOKEN?.trim();
const GMAIL_OAUTH_USER = process.env.GMAIL_OAUTH_USER?.trim();
const EMAIL_FROM = process.env.EMAIL_FROM?.trim();

const requiredEmailEnv = [
    { key: "GMAIL_OAUTH_CLIENT_ID", value: GMAIL_OAUTH_CLIENT_ID },
    { key: "GMAIL_OAUTH_CLIENT_SECRET", value: GMAIL_OAUTH_CLIENT_SECRET },
    { key: "GMAIL_OAUTH_REFRESH_TOKEN", value: GMAIL_OAUTH_REFRESH_TOKEN },
    { key: "GMAIL_OAUTH_USER", value: GMAIL_OAUTH_USER },
    { key: "EMAIL_FROM", value: EMAIL_FROM },
];

const missingRequiredEmailEnv = requiredEmailEnv
    .filter((entry) => !entry.value)
    .map((entry) => entry.key);

const hasGmailOAuthConfig = missingRequiredEmailEnv.length === 0;
const missingEmailEnvMessage = `Missing Gmail OAuth email configuration: ${missingRequiredEmailEnv.join(", ")}`;

if (!hasGmailOAuthConfig) {
    if (process.env.NODE_ENV === "production") {
        throw new Error(missingEmailEnvMessage);
    }
    console.warn(`[EMAIL] ${missingEmailEnvMessage}. Email sending disabled for this environment.`);
}

const gmailOAuthClient = hasGmailOAuthConfig
    ? new google.auth.OAuth2(
          GMAIL_OAUTH_CLIENT_ID,
          GMAIL_OAUTH_CLIENT_SECRET,
      )
    : null;

if (gmailOAuthClient && GMAIL_OAUTH_REFRESH_TOKEN) {
    gmailOAuthClient.setCredentials({
        refresh_token: GMAIL_OAUTH_REFRESH_TOKEN,
    });
}

function isValidEmailAddress(value: string | null | undefined): value is string {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function parseEmailAddress(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;

    const angleBracketMatch = trimmed.match(/<([^<>]+)>/);
    const candidate = (angleBracketMatch?.[1] || trimmed).trim();
    return isValidEmailAddress(candidate) ? candidate : null;
}

const organizerEmailForIcs = parseEmailAddress(EMAIL_FROM)
    || parseEmailAddress(GMAIL_OAUTH_USER)
    || "noreply@monet.ai";

export function getCalendarInviteOrganizerEmail() {
    return organizerEmailForIcs;
}

export async function sendTransactionalEmail({
    to,
    subject,
    html,
    text,
    attachments,
    icalEvent,
}: TransactionalEmailMessage) {
    try {
        if (!hasGmailOAuthConfig || !gmailOAuthClient) {
            console.log(`[EMAIL][DEV] Would send to ${to}: ${subject}`);
            return false;
        }

        const accessTokenResponse = await gmailOAuthClient.getAccessToken();
        const accessToken = typeof accessTokenResponse === "string"
            ? accessTokenResponse
            : accessTokenResponse?.token;

        if (!accessToken) {
            throw new Error("Failed to obtain Gmail OAuth access token");
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                type: "OAuth2",
                user: GMAIL_OAUTH_USER!,
                clientId: GMAIL_OAUTH_CLIENT_ID!,
                clientSecret: GMAIL_OAUTH_CLIENT_SECRET!,
                refreshToken: GMAIL_OAUTH_REFRESH_TOKEN!,
                accessToken,
            },
        });

        await transporter.sendMail({
            from: EMAIL_FROM!,
            to,
            subject,
            text,
            html,
            attachments,
            icalEvent,
        });

        return true;
    } catch (error) {
        console.error("Error sending email:", error);
        throw error;
    }
}
