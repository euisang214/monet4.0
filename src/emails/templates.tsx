import type { ReactNode } from "react";
import { Link, Text } from "@react-email/components";
import {
    EmailBodyText,
    EmailBulletList,
    EmailCodeCard,
    EmailDetailCard,
    EmailDetailRow,
    MonetEmailLayout,
} from "./layout";

type CalendarInviteEmailProps = {
    subject: string;
    localTimeLabel: string;
    localTimeValue: string;
    meetingUrl: string | null;
    hasValidMeetingUrl: boolean;
    counterpartName: string;
};

type CalendarInviteCancelEmailProps = {
    scheduledTimeLabel: string;
    scheduledTimeValue: string;
    localTimeLabel: string;
    localTimeValue: string;
    counterpartName: string;
};

type FeedbackRevisionEmailProps = {
    bookingId: string;
    reasons: string[];
    reviewLink: string;
};

type BookingRequestedEmailProps = {
    formattedPrice: string;
    requestLink: string;
};

type BookingDeclinedEmailProps = {
    declineReason: string;
    browseLink: string;
};

type PayoutReleasedEmailProps = {
    formattedAmount: string;
    transferId: string | null;
};

type PasswordResetEmailProps = {
    resetLink: string;
};

type VerificationEmailProps = {
    token: string;
};

function renderLinkedValue(label: string, href: string | null, fallback: string) {
    if (!href) {
        return <>{fallback}</>;
    }

    return (
        <Link href={href} style={{ color: "#1d4ed8", textDecoration: "underline" }}>
            {label}
        </Link>
    );
}

function renderOutro(children: ReactNode) {
    return (
        <Text style={{ color: "#475569", fontSize: "13px", lineHeight: "1.7", margin: "0 0 16px" }}>
            {children}
        </Text>
    );
}

export function CalendarInviteRequestEmail({
    subject,
    localTimeLabel,
    localTimeValue,
    meetingUrl,
    hasValidMeetingUrl,
    counterpartName,
}: CalendarInviteEmailProps) {
    return (
        <MonetEmailLayout
            preview={subject}
            eyebrow="Consultation scheduled"
            heading={subject}
            intro="Your session is confirmed. The key details are below, and the calendar invite attached to this email is the best place to RSVP."
            cta={hasValidMeetingUrl && meetingUrl ? { label: "Open meeting link", href: meetingUrl } : undefined}
            outro={renderOutro("Please use your calendar client's RSVP controls to accept or decline the invitation.")}
        >
            <EmailDetailCard>
                <EmailDetailRow label={localTimeLabel} value={localTimeValue} />
                <EmailDetailRow label="Counterpart" value={counterpartName} />
                <EmailDetailRow
                    label="Zoom Link"
                    value={renderLinkedValue(meetingUrl || "Zoom link", meetingUrl, "Included in invite details")}
                />
            </EmailDetailCard>
            <EmailBodyText>
                Kafei keeps the scheduling details tight so you can focus on the conversation itself, not the logistics around it.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}

export function CalendarInviteCancelEmail({
    scheduledTimeLabel,
    scheduledTimeValue,
    localTimeLabel,
    localTimeValue,
    counterpartName,
}: CalendarInviteCancelEmailProps) {
    return (
        <MonetEmailLayout
            preview="Consultation call canceled"
            eyebrow="Schedule update"
            heading="Consultation Call Canceled"
            intro="This session is no longer scheduled. We’ve included the original timing below so you can update your calendar with confidence."
        >
            <EmailDetailCard>
                <EmailDetailRow label={scheduledTimeLabel} value={scheduledTimeValue} />
                <EmailDetailRow label={localTimeLabel} value={localTimeValue} />
                <EmailDetailRow label="Counterpart" value={counterpartName} />
            </EmailDetailCard>
            <EmailBodyText>
                A cancellation update is attached to this email so your calendar client can clear the event automatically.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}

export function FeedbackRevisionEmail({
    bookingId,
    reasons,
    reviewLink,
}: FeedbackRevisionEmailProps) {
    return (
        <MonetEmailLayout
            preview={`Revise your feedback for booking #${bookingId}`}
            eyebrow="Action required"
            heading="Revise your consultation feedback"
            intro={`Your feedback for booking #${bookingId} needs one more pass before payout can be released.`}
            cta={{ label: "Revise feedback", href: reviewLink }}
        >
            <EmailBodyText>
                The current submission did not clear Kafei’s quality review. Use the notes below to tighten the response and resubmit.
            </EmailBodyText>
            <EmailBulletList items={reasons} />
            <EmailBodyText>
                Keep the revision concrete and candidate-specific. The strongest submissions explain why the advice matters, not just what to do next.
            </EmailBodyText>
            <EmailDetailCard>
                <EmailDetailRow label="Reminder" value="Minimum 200 words of detailed advice" />
                <EmailDetailRow label="Reminder" value="Exactly 3 distinct, actionable next steps" />
            </EmailDetailCard>
        </MonetEmailLayout>
    );
}

export function BookingRequestedEmail({
    formattedPrice,
    requestLink,
}: BookingRequestedEmailProps) {
    return (
        <MonetEmailLayout
            preview="A new consultation request is ready for review"
            eyebrow="New booking request"
            heading="A new candidate request just came in"
            intro="You’ve received a new request for a consultation call. Review the booking details, confirm fit, and respond while the request is still active."
            cta={{ label: "Review request", href: requestLink }}
        >
            <EmailDetailCard>
                <EmailDetailRow label="Proposed Price" value={formattedPrice} />
                <EmailDetailRow label="Response Window" value="This request expires in 120 hours" />
            </EmailDetailCard>
            <EmailBodyText>
                A fast response keeps the candidate experience strong and helps protect the momentum behind the request.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}

export function BookingDeclinedEmail({
    declineReason,
    browseLink,
}: BookingDeclinedEmailProps) {
    return (
        <MonetEmailLayout
            preview="Your booking request was declined"
            eyebrow="Booking update"
            heading="This request wasn’t accepted"
            intro="The professional declined your consultation request. Your authorized funds have been released, and you can immediately continue browsing for a better fit."
            cta={{ label: "Browse professionals", href: browseLink }}
        >
            <EmailDetailCard>
                <EmailDetailRow label="Reason" value={declineReason} />
            </EmailDetailCard>
            <EmailBodyText>
                Kafei keeps the process moving so you can quickly rebook with another professional aligned to your goals.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}

export function PayoutReleasedEmail({
    formattedAmount,
    transferId,
}: PayoutReleasedEmailProps) {
    return (
        <MonetEmailLayout
            preview={`Your payout of ${formattedAmount} has been released`}
            eyebrow="Payout released"
            heading="Your payout is on the way"
            intro="The session payout has been released to your connected Stripe account. We’ve included the transfer details below for reference."
        >
            <EmailDetailCard>
                <EmailDetailRow label="Amount" value={formattedAmount} />
                <EmailDetailRow label="Transfer ID" value={transferId || "Pending Stripe reference"} />
            </EmailDetailCard>
            <EmailBodyText>
                Thank you for delivering a strong consultation experience. High-quality sessions are what make the marketplace valuable on both sides.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}

export function PasswordResetEmail({
    resetLink,
}: PasswordResetEmailProps) {
    return (
        <MonetEmailLayout
            preview="Reset your Kafei password"
            eyebrow="Account security"
            heading="Reset your password"
            intro="We received a request to reset your password. If that was you, use the secure link below to choose a new one."
            cta={{ label: "Reset password", href: resetLink }}
            outro={renderOutro("This reset link expires in 1 hour. If you didn’t request it, no further action is needed.")}
        >
            <EmailBodyText>
                For security, the link works only for a limited time and should not be forwarded.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}

export function VerificationEmail({
    token,
}: VerificationEmailProps) {
    return (
        <MonetEmailLayout
            preview="Verify your corporate email"
            eyebrow="Verification required"
            heading="Verify your corporate email"
            intro="Enter the code below in Kafei to confirm the inbox tied to your current employer."
        >
            <EmailCodeCard code={token} />
            <EmailBodyText>
                The code expires in 24 hours. If you requested another code, only the most recent one will work.
            </EmailBodyText>
        </MonetEmailLayout>
    );
}
