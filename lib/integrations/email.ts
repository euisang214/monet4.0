import { createElement } from "react";
import type { Payout } from "@prisma/client";
import { appRoutes } from "@/lib/shared/routes";
import {
    buildCalendarInviteCancelEmail,
    buildCalendarInviteRequestEmail,
    type BookingWithRelations,
    type CalendarInviteRecipientRole,
} from "@/lib/integrations/email-calendar-invites";
import {
    sendTransactionalEmail,
    type TransactionalEmailMessage,
} from "@/lib/integrations/email-transport";
import {
    CalendarInviteCancelEmail,
    CalendarInviteRequestEmail,
    BookingDeclinedEmail,
    BookingRequestedEmail,
    FeedbackRevisionEmail,
    PasswordResetEmail,
    PayoutReleasedEmail,
    VerificationEmail,
} from "@/emails/templates";
import { renderEmailTemplate } from "@/emails/render";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type SendEmailParams = TransactionalEmailMessage;

function formatCurrencyFromCents(cents: number | null | undefined) {
    return `$${((cents || 0) / 100).toFixed(2)}`;
}

export async function sendEmail(params: SendEmailParams) {
    return sendTransactionalEmail(params);
}

export type { CalendarInviteRecipientRole };

export async function sendCalendarInviteRequestEmail(
    booking: BookingWithRelations,
    role: CalendarInviteRecipientRole,
    uid: string,
    sequence: number,
    zoomInviteText: string,
) {
    const builtInvite = buildCalendarInviteRequestEmail(booking, role, uid, sequence, zoomInviteText);
    const { html, text } = await renderEmailTemplate(
        createElement(CalendarInviteRequestEmail, {
            subject: builtInvite.subject,
            localTimeLabel: `Your Local Time (${builtInvite.inviteTimeContext.recipientTimezone})`,
            localTimeValue: builtInvite.inviteTimeContext.recipientDateTime,
            meetingUrl: builtInvite.meetingUrl,
            hasValidMeetingUrl: builtInvite.hasValidMeetingUrl,
            counterpartName: builtInvite.counterpartName,
        }),
        builtInvite.textLines.join("\n"),
    );

    await sendEmail({
        to: builtInvite.recipientEmail,
        subject: builtInvite.subject,
        html,
        text,
        icalEvent: builtInvite.icalEvent,
    });
}

export async function sendCalendarInviteCancelEmail(
    booking: BookingWithRelations,
    role: CalendarInviteRecipientRole,
    uid: string,
    sequence: number,
    zoomInviteText: string,
) {
    const builtInvite = buildCalendarInviteCancelEmail(booking, role, uid, sequence, zoomInviteText);
    const { html, text } = await renderEmailTemplate(
        createElement(CalendarInviteCancelEmail, {
            scheduledTimeLabel: `Scheduled Time (${builtInvite.inviteTimeContext.canonicalTimezone})`,
            scheduledTimeValue: builtInvite.inviteTimeContext.canonicalDateTime,
            localTimeLabel: `Your Local Time (${builtInvite.inviteTimeContext.recipientTimezone})`,
            localTimeValue: builtInvite.inviteTimeContext.recipientDateTime,
            counterpartName: builtInvite.counterpartName,
        }),
        builtInvite.textLines.join("\n"),
    );

    await sendEmail({
        to: builtInvite.recipientEmail,
        subject: builtInvite.subject,
        html,
        text,
        icalEvent: builtInvite.icalEvent,
    });
}

export async function sendFeedbackRevisionEmail(
    email: string,
    bookingId: string,
    reasons: string[],
) {
    const subject = "Action Required: Revise your Consultation Feedback";
    const { html, text } = await renderEmailTemplate(
        createElement(FeedbackRevisionEmail, {
            bookingId,
            reasons,
            reviewLink: `${appUrl}${appRoutes.professional.feedback(bookingId)}`,
        }),
    );

    await sendEmail({
        to: email,
        subject,
        html,
        text,
    });
}

export async function sendBookingRequestedEmail(
    booking: BookingWithRelations,
    professionalEmail: string,
) {
    const subject = "New Booking Request: Consultation Call";
    const { html, text } = await renderEmailTemplate(
        createElement(BookingRequestedEmail, {
            formattedPrice: formatCurrencyFromCents(booking.priceCents),
            requestLink: `${appUrl}${appRoutes.professional.requestDetails(booking.id)}`,
        }),
    );

    await sendEmail({
        to: professionalEmail,
        subject,
        html,
        text,
    });
}

export async function sendBookingDeclinedEmail(
    booking: BookingWithRelations,
) {
    const subject = "Update on your Booking Request";
    const { html, text } = await renderEmailTemplate(
        createElement(BookingDeclinedEmail, {
            declineReason: booking.declineReason || "No reason provided.",
            browseLink: `${appUrl}${appRoutes.candidate.browse}`,
        }),
    );

    await sendEmail({
        to: booking.candidate.email,
        subject,
        html,
        text,
    });
}

export async function sendPayoutReleasedEmail(
    payout: Payout,
    professionalEmail: string,
) {
    const subject = `Payout Released: ${formatCurrencyFromCents(payout.amountNet)}`;
    const { html, text } = await renderEmailTemplate(
        createElement(PayoutReleasedEmail, {
            formattedAmount: formatCurrencyFromCents(payout.amountNet),
            transferId: payout.stripeTransferId,
        }),
    );

    await sendEmail({
        to: professionalEmail,
        subject,
        html,
        text,
    });
}

export async function sendPasswordResetEmail(email: string, token: string) {
    const subject = "Reset Your Password";
    const resetLink = `${appUrl}/auth/reset?token=${token}`;
    const { html, text } = await renderEmailTemplate(
        createElement(PasswordResetEmail, { resetLink }),
    );

    await sendEmail({
        to: email,
        subject,
        html,
        text,
    });
}

export async function sendVerificationEmail(email: string, token: string) {
    const subject = "Verify Your Corporate Email";
    const { html, text } = await renderEmailTemplate(
        createElement(VerificationEmail, { token }),
    );

    await sendEmail({
        to: email,
        subject,
        html,
        text,
    });
}
