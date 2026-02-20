
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import { createEvent, DateArray } from 'ics';
import { Booking, User, ProfessionalProfile, Payout } from '@prisma/client';
import { appRoutes } from '@/lib/shared/routes';

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
    attachments?: {
        filename: string;
        content: string | Buffer;
        contentType?: string;
    }[];
}

export async function sendEmail({ to, subject, html, attachments }: SendEmailParams) {
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
            html,
            attachments,
        });
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

type BookingWithRelations = Booking & {
    candidate: User;
    professional: User;
    professionalProfile?: ProfessionalProfile | null;
};

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const organizerEmail = EMAIL_FROM || 'noreply@monet.local';

export function isValidAbsoluteHttpUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

export async function sendBookingAcceptedEmail(
    booking: BookingWithRelations,
    role: 'CANDIDATE' | 'PROFESSIONAL'
) {
    if (!booking.startAt || !booking.endAt) {
        console.error('Booking missing start/end time, cannot send confirmation email');
        return;
    }

    const startDate = new Date(booking.startAt);
    const endDate = new Date(booking.endAt);

    // Create ICS Event
    const icsStart: DateArray = [
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
        startDate.getUTCDate(),
        startDate.getUTCHours(),
        startDate.getUTCMinutes(),
    ];

    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    const duration = { hours: Math.floor(durationMinutes / 60), minutes: durationMinutes % 60 };

    const meetingUrl = booking.zoomJoinUrl?.trim() || null;
    const hasValidMeetingUrl = isValidAbsoluteHttpUrl(meetingUrl);
    const meetingLabel = hasValidMeetingUrl ? meetingUrl : 'link pending';
    const icsDescription = hasValidMeetingUrl
        ? `Join Zoom Meeting: ${meetingUrl}`
        : 'Join Zoom Meeting: link pending';

    const { error, value: icsContent } = createEvent({
        start: icsStart,
        duration,
        title: `Consultation Call (${role === 'CANDIDATE' ? 'Professional' : 'Candidate'})`,
        description: icsDescription,
        ...(hasValidMeetingUrl ? { location: meetingUrl, url: meetingUrl } : {}),
        categories: ['Consultation', 'Monet'],
        status: 'CONFIRMED',
        busyStatus: 'BUSY',
        organizer: { name: 'Monet Platform', email: organizerEmail },
        attendees: [
            { name: 'Professional', email: booking.professional.email, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' },
            { name: 'Candidate', email: booking.candidate.email, rsvp: true, partstat: 'ACCEPTED', role: 'REQ-PARTICIPANT' }
        ]
    });

    if (error) {
        console.error('Error generating ICS file:', error);
    }

    const attachments = icsContent ? [{
        filename: 'consultation.ics',
        content: icsContent,
        contentType: 'text/calendar',
    }] : undefined;

    const subject = `Booking Confirmed: Consultation Call`;
    let html = '';

    if (role === 'CANDIDATE') {
        html = `
      <h1>Booking Confirmed!</h1>
      <p>Your consultation has been accepted by the professional.</p>
      <p><strong>Time:</strong> ${startDate.toUTCString()}</p>
      <p><strong>Zoom Link:</strong> ${hasValidMeetingUrl ? `<a href="${meetingUrl}">${meetingUrl}</a>` : meetingLabel}</p>
      <p>A calendar invitation is attached.</p>
    `;
    } else {
        html = `
      <h1>Booking Confirmed!</h1>
      <p>You have accepted the consultation request.</p>
      <p><strong>Time:</strong> ${startDate.toUTCString()}</p>
      <p><strong>Zoom Link:</strong> ${hasValidMeetingUrl ? `<a href="${meetingUrl}">${meetingUrl}</a>` : meetingLabel}</p>
      <p>A calendar invitation is attached.</p>
    `;
    }

    const to = role === 'CANDIDATE' ? booking.candidate.email : booking.professional.email;

    await sendEmail({
        to,
        subject,
        html,
        attachments,
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
