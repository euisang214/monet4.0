
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { createEvent, DateArray } from 'ics';
import { formatInTimeZone } from 'date-fns-tz';
import { Booking, User, ProfessionalProfile, Payout, Experience } from '@prisma/client';
import { appRoutes } from '@/lib/shared/routes';
import { normalizeTimezone } from '@/lib/utils/supported-timezones';
import { deriveCurrentRoleFromExperiences } from '@/lib/domain/users/current-role';

const GMAIL_OAUTH_CLIENT_ID = process.env.GMAIL_OAUTH_CLIENT_ID?.trim();
const GMAIL_OAUTH_CLIENT_SECRET = process.env.GMAIL_OAUTH_CLIENT_SECRET?.trim();
const GMAIL_OAUTH_REFRESH_TOKEN = process.env.GMAIL_OAUTH_REFRESH_TOKEN?.trim();
const GMAIL_OAUTH_USER = process.env.GMAIL_OAUTH_USER?.trim();
const EMAIL_FROM = process.env.EMAIL_FROM?.trim();

const requiredEmailEnv = [
    { key: 'GMAIL_OAUTH_CLIENT_ID', value: GMAIL_OAUTH_CLIENT_ID },
    { key: 'GMAIL_OAUTH_CLIENT_SECRET', value: GMAIL_OAUTH_CLIENT_SECRET },
    { key: 'GMAIL_OAUTH_REFRESH_TOKEN', value: GMAIL_OAUTH_REFRESH_TOKEN },
    { key: 'GMAIL_OAUTH_USER', value: GMAIL_OAUTH_USER },
    { key: 'EMAIL_FROM', value: EMAIL_FROM },
];

const missingRequiredEmailEnv = requiredEmailEnv
    .filter((entry) => !entry.value)
    .map((entry) => entry.key);

const hasGmailOAuthConfig = missingRequiredEmailEnv.length === 0;
const missingEmailEnvMessage = `Missing Gmail OAuth email configuration: ${missingRequiredEmailEnv.join(', ')}`;

if (!hasGmailOAuthConfig) {
    if (process.env.NODE_ENV === 'production') {
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

interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
    attachments?: {
        filename: string;
        content: string | Buffer;
        contentType?: string;
    }[];
    icalEvent?: {
        method: 'PUBLISH' | 'REQUEST' | 'CANCEL';
        content: string | Buffer;
        filename?: string;
    };
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

export async function sendEmail({ to, subject, html, text, attachments, icalEvent }: SendEmailParams) {
    try {
        if (!hasGmailOAuthConfig || !gmailOAuthClient) {
            console.log(`[EMAIL][DEV] Would send to ${to}: ${subject}`);
            return false;
        }

        const accessTokenResponse = await gmailOAuthClient.getAccessToken();
        const accessToken = typeof accessTokenResponse === 'string'
            ? accessTokenResponse
            : accessTokenResponse?.token;

        if (!accessToken) {
            throw new Error('Failed to obtain Gmail OAuth access token');
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
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
        console.error('Error sending email:', error);
        throw error;
    }
}

type BookingWithRelations = Booking & {
    candidate: User;
    professional: User & {
        professionalProfile?: (ProfessionalProfile & {
            experience?: Experience[];
        }) | null;
    };
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const organizerEmailForIcs = parseEmailAddress(EMAIL_FROM)
    || parseEmailAddress(GMAIL_OAUTH_USER)
    || 'noreply@monet.ai';

export function isValidAbsoluteHttpUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export type CalendarInviteRecipientRole = 'CANDIDATE' | 'PROFESSIONAL';

function getRoleSpecificMeetingUrl(booking: BookingWithRelations, role: CalendarInviteRecipientRole) {
    const roleSpecificMeetingUrl = (
        role === 'CANDIDATE'
            ? booking.candidateZoomJoinUrl
            : booking.professionalZoomJoinUrl
    )?.trim() || null;

    return roleSpecificMeetingUrl || booking.zoomJoinUrl?.trim() || null;
}

function getDisplayName(user: User, fallbackLabel: string) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (fullName) {
        return fullName;
    }
    return fallbackLabel;
}

function buildRequestSubject(booking: BookingWithRelations, role: CalendarInviteRecipientRole) {
    if (role === 'PROFESSIONAL') {
        return `Kafei - Chat with ${getDisplayName(booking.candidate, 'Candidate')}`;
    }

    const professionalExperiences = booking.professional.professionalProfile?.experience ?? [];
    const currentRole = deriveCurrentRoleFromExperiences(professionalExperiences);
    const hasCompleteRoleLabel = Boolean(currentRole.title && currentRole.employer);
    const roleLabel = hasCompleteRoleLabel
        ? `${currentRole.title} @ ${currentRole.employer}`
        : 'Professional';

    return `Kafei - Chat with ${roleLabel}`;
}

function buildInviteDescription({
    booking,
    role,
    method,
    zoomInviteText,
    canonicalDateTime,
    canonicalTimezone,
    recipientDateTime,
    recipientTimezone,
}: {
    booking: BookingWithRelations;
    role: CalendarInviteRecipientRole;
    method: 'REQUEST' | 'CANCEL';
    zoomInviteText: string;
    canonicalDateTime: string;
    canonicalTimezone: string;
    recipientDateTime: string;
    recipientTimezone: string;
}) {
    const counterpartName = role === 'CANDIDATE'
        ? getDisplayName(booking.professional, 'Professional')
        : getDisplayName(booking.candidate, 'Candidate');

    const timeLine = method === 'REQUEST'
        ? `Your Local Time (${recipientTimezone}): ${recipientDateTime}`
        : `Scheduled Time (${canonicalTimezone}): ${canonicalDateTime}`;

    return [
        zoomInviteText.trim(),
        '',
        timeLine,
        `Counterpart: ${counterpartName}`,
    ].join('\n');
}

function buildIcsStartDateArray(startDate: Date): DateArray {
    return [
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
        startDate.getUTCDate(),
        startDate.getUTCHours(),
        startDate.getUTCMinutes(),
    ];
}

function buildIcsDuration(startDate: Date, endDate: Date) {
    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    return { hours: Math.floor(durationMinutes / 60), minutes: durationMinutes % 60 };
}

function getCanonicalBookingTimezone(bookingTimezone: string | null | undefined) {
    return normalizeTimezone(bookingTimezone ?? 'UTC');
}

function getRecipientTimezone(role: CalendarInviteRecipientRole, booking: BookingWithRelations) {
    const recipient = role === 'CANDIDATE' ? booking.candidate : booking.professional;
    const recipientTimezone = typeof recipient.timezone === 'string' ? recipient.timezone : null;
    return normalizeTimezone(recipientTimezone ?? booking.timezone);
}

function formatDateTimeForTimezone(date: Date, timezone: string) {
    return formatInTimeZone(date, timezone, "MMM d, yyyy 'at' h:mm a");
}

function buildInviteTimeContext(role: CalendarInviteRecipientRole, booking: BookingWithRelations, startDate: Date) {
    const canonicalTimezone = getCanonicalBookingTimezone(booking.timezone);
    const recipientTimezone = getRecipientTimezone(role, booking);

    return {
        canonicalTimezone,
        canonicalDateTime: formatDateTimeForTimezone(startDate, canonicalTimezone),
        recipientTimezone,
        recipientDateTime: formatDateTimeForTimezone(startDate, recipientTimezone),
    };
}

function createCalendarInviteContent({
    booking,
    role,
    uid,
    sequence,
    method,
    zoomInviteText,
    eventTitle,
}: {
    booking: BookingWithRelations;
    role: CalendarInviteRecipientRole;
    uid: string;
    sequence: number;
    method: 'REQUEST' | 'CANCEL';
    zoomInviteText: string;
    eventTitle: string;
}) {
    if (!booking.startAt || !booking.endAt) {
        throw new Error(`Booking ${booking.id} missing start/end time`);
    }

    const startDate = new Date(booking.startAt);
    const endDate = new Date(booking.endAt);
    const meetingUrl = getRoleSpecificMeetingUrl(booking, role);
    const hasValidMeetingUrl = isValidAbsoluteHttpUrl(meetingUrl);
    const recipient = role === 'CANDIDATE' ? booking.candidate : booking.professional;
    const inviteTimeContext = buildInviteTimeContext(role, booking, startDate);

    const eventResult = createEvent({
        uid,
        sequence,
        method,
        start: buildIcsStartDateArray(startDate),
        startInputType: 'utc',
        startOutputType: 'utc',
        endInputType: 'utc',
        endOutputType: 'utc',
        duration: buildIcsDuration(startDate, endDate),
        title: eventTitle,
        description: buildInviteDescription({
            booking,
            role,
            method,
            zoomInviteText,
            canonicalDateTime: inviteTimeContext.canonicalDateTime,
            canonicalTimezone: inviteTimeContext.canonicalTimezone,
            recipientDateTime: inviteTimeContext.recipientDateTime,
            recipientTimezone: inviteTimeContext.recipientTimezone,
        }),
        ...(hasValidMeetingUrl ? { location: meetingUrl, url: meetingUrl } : {}),
        status: method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED',
        busyStatus: method === 'CANCEL' ? 'FREE' : 'BUSY',
        organizer: { name: 'Monet Platform', email: organizerEmailForIcs },
        attendees: [
            {
                name: getDisplayName(recipient, role === 'CANDIDATE' ? 'Candidate' : 'Professional'),
                email: recipient.email,
                rsvp: true,
                partstat: method === 'CANCEL' ? 'DECLINED' : 'NEEDS-ACTION',
                role: 'REQ-PARTICIPANT',
            },
        ],
    });

    if (eventResult.error || !eventResult.value) {
        const reason = eventResult.error instanceof Error
            ? eventResult.error.message
            : String(eventResult.error || 'unknown_error');
        throw new Error(`Failed to create calendar invite ICS: ${reason}`);
    }

    return {
        icsContent: eventResult.value,
        meetingUrl,
        hasValidMeetingUrl,
        startDate,
        inviteTimeContext,
    };
}

export async function sendCalendarInviteRequestEmail(
    booking: BookingWithRelations,
    role: CalendarInviteRecipientRole,
    uid: string,
    sequence: number,
    zoomInviteText: string
) {
    const recipientEmail = role === 'CANDIDATE' ? booking.candidate.email : booking.professional.email;
    const requestSubject = buildRequestSubject(booking, role);
    const { icsContent, meetingUrl, hasValidMeetingUrl, inviteTimeContext } = createCalendarInviteContent({
        booking,
        role,
        uid,
        sequence,
        method: 'REQUEST',
        zoomInviteText,
        eventTitle: requestSubject,
    });

    await sendEmail({
        to: recipientEmail,
        subject: requestSubject,
        text: [
            'Please respond to the calendar invitation for your consultation call.',
            `Your Local Time (${inviteTimeContext.recipientTimezone}): ${inviteTimeContext.recipientDateTime}`,
            'Please use your calendar client\'s RSVP controls to accept or decline.',
        ].join('\n'),
        html: `
            <h1>${requestSubject}</h1>
            <p>Your consultation call has been scheduled.</p>
            <p><strong>Your Local Time (${inviteTimeContext.recipientTimezone}):</strong> ${inviteTimeContext.recipientDateTime}</p>
            <p><strong>Zoom Link:</strong> ${hasValidMeetingUrl ? `<a href="${meetingUrl}">${meetingUrl}</a>` : 'Included in invite details'}</p>
            <p>Please use your calendar client's RSVP controls to accept or decline.</p>
        `,
        icalEvent: {
            method: 'REQUEST',
            content: icsContent,
            filename: 'consultation.ics',
        },
    });
}

export async function sendCalendarInviteCancelEmail(
    booking: BookingWithRelations,
    role: CalendarInviteRecipientRole,
    uid: string,
    sequence: number,
    zoomInviteText: string
) {
    const recipientEmail = role === 'CANDIDATE' ? booking.candidate.email : booking.professional.email;
    const { icsContent, inviteTimeContext } = createCalendarInviteContent({
        booking,
        role,
        uid,
        sequence,
        method: 'CANCEL',
        zoomInviteText,
        eventTitle: 'Consultation Call',
    });

    await sendEmail({
        to: recipientEmail,
        subject: 'Canceled: Consultation Call',
        text: [
            'Your consultation call has been canceled.',
            `Scheduled Time (${inviteTimeContext.canonicalTimezone}): ${inviteTimeContext.canonicalDateTime}`,
            `Your Local Time (${inviteTimeContext.recipientTimezone}): ${inviteTimeContext.recipientDateTime}`,
        ].join('\n'),
        html: `
            <h1>Consultation Call Canceled</h1>
            <p>Your consultation call has been canceled.</p>
            <p><strong>Scheduled Time (${inviteTimeContext.canonicalTimezone}):</strong> ${inviteTimeContext.canonicalDateTime}</p>
            <p><strong>Your Local Time (${inviteTimeContext.recipientTimezone}):</strong> ${inviteTimeContext.recipientDateTime}</p>
            <p>A calendar cancellation update is attached to this message.</p>
        `,
        icalEvent: {
            method: 'CANCEL',
            content: icsContent,
            filename: 'consultation-cancel.ics',
        },
    });
}

/**
 * Sends an email to the professional requesting feedback revision.
 */
export async function sendFeedbackRevisionEmail(
    email: string,
    bookingId: string,
    reasons: string[]
) {
    const subject = `Action Required: Revise your Consultation Feedback`;

    // Construct list of reasons
    const reasonsList = reasons.map(r => `<li>${r}</li>`).join('');

    const html = `
        <h1>Feedback Revision Required</h1>
        <p>Thank you for submitting your feedback for booking <strong>#${bookingId}</strong>.</p>
        <p>However, your submission did not meet our Quality Control standards for the following reasons:</p>
        <ul>
            ${reasonsList}
        </ul>
        <p>Please log in to your dashboard and update the feedback to release your payout.</p>
        <p><a href="${appUrl}${appRoutes.professional.feedback(bookingId)}">Edit Feedback</a></p>
        <p><strong>Reminders:</strong></p>
        <ul>
            <li>Minimum 200 words of detailed advice.</li>
            <li>Exactly 3 distinct, actionable next steps.</li>
        </ul>
    `;

    await sendEmail({
        to: email,
        subject,
        html,
    });
}

export async function sendBookingRequestedEmail(
    booking: BookingWithRelations,
    professionalEmail: string
) {
    const subject = `New Booking Request: Consultation Call`;

    const html = `
        <h1>New Booking Request!</h1>
        <p>You have received a new consultation request from a candidate.</p>
        <p><strong>Proposed Price:</strong> $${(booking.priceCents || 0) / 100}</p>
        <p>Please log in to your dashboard to review and accept or decline this request. This request will expire in 120 hours.</p>
        <p><a href="${appUrl}${appRoutes.professional.requestDetails(booking.id)}">View Request</a></p>
    `;

    await sendEmail({
        to: professionalEmail,
        subject,
        html,
    });
}

export async function sendBookingDeclinedEmail(
    booking: BookingWithRelations
) {
    const subject = `Update on your Booking Request`;

    const html = `
        <h1>Booking Request Declined</h1>
        <p>The professional has declined your consultation request.</p>
        <p><strong>Reason:</strong> ${booking.declineReason || 'No reason provided.'}</p>
        <p>Any authorized funds have been released.</p>
        <p><a href="${appUrl}${appRoutes.candidate.browse}">Browse Other Professionals</a></p>
    `;

    await sendEmail({
        to: booking.candidate.email,
        subject,
        html,
    });
}

export async function sendPayoutReleasedEmail(
    payout: Payout,
    professionalEmail: string
) {
    const subject = `Payout Released: $${(payout.amountNet / 100).toFixed(2)}`;

    const html = `
        <h1>Payout Sent!</h1>
        <p>Your payout of <strong>$${(payout.amountNet / 100).toFixed(2)}</strong> has been released to your Stripe account.</p>
        <p>Transfer ID: ${payout.stripeTransferId}</p>
        <p>Thank you for providing high-quality consultation!</p>
    `;

    await sendEmail({
        to: professionalEmail,
        subject,
        html,
    });
}


export async function sendPasswordResetEmail(email: string, token: string) {
    const subject = 'Reset Your Password';
    const resetLink = `${appUrl}/auth/reset?token=${token}`;

    const html = `
        <h1>Password Reset Request</h1>
        <p>You requested to reset your password. Click the link below to set a new password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
    `;

    await sendEmail({
        to: email,
        subject,
        html,
    });
}

export async function sendVerificationEmail(email: string, token: string) {
    const subject = 'Verify Your Corporate Email';

    // For corporate verification, we usually provide a code or a link. 
    // The implementation plan says "Generate token... Send email". 
    // And "POST /api/shared/verification/confirm" takes the token.
    // If it's a code, the UI will ask for it. If it's a link, UI handles param.
    // I'll make it a code for simplicity as per "Verify Work Email" usually implies code or link.
    // CLAUDE.md schema `Verification` has `token` string.
    // I'll assume it's a code to be copied-pasted or a link. Let's provide both or a link that auto-fills.
    // But typically "enter code" is easier if sticking to same session.
    // Let's assume link for smoother flow: /professional/settings?verification_token=...
    // Or just a clear code. I'll provide the code.

    const html = `
        <h1>Verify Your Corporate Email</h1>
        <p>Use the following code to verify your corporate email address on Monet:</p>
        <div style="background:#f4f4f4;padding:12px;text-align:center;font-size:24px;font-weight:bold;letter-spacing:4px;">
            ${token}
        </div>
        <p>This code expires in 24 hours.</p>
    `;

    await sendEmail({
        to: email,
        subject,
        html,
    });
}
