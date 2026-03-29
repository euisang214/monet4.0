import { createEvent, type DateArray } from "ics";
import { formatInTimeZone } from "date-fns-tz";
import type { Booking, Experience, ProfessionalProfile, User } from "@prisma/client";
import { deriveCurrentRoleFromExperiences } from "@/lib/domain/users/current-role";
import { normalizeTimezone } from "@/lib/utils/supported-timezones";
import { getCalendarInviteOrganizerEmail } from "@/lib/integrations/email-transport";

export type CalendarInviteRecipientRole = "CANDIDATE" | "PROFESSIONAL";

export type BookingWithRelations = Booking & {
    candidate: User;
    professional: User & {
        professionalProfile?: (ProfessionalProfile & {
            experience?: Experience[];
        }) | null;
    };
};

type InviteMethod = "REQUEST" | "CANCEL";

export type InviteTimeContext = {
    canonicalTimezone: string;
    canonicalDateTime: string;
    recipientTimezone: string;
    recipientDateTime: string;
};

export type BuiltCalendarInviteEmail = {
    recipientEmail: string;
    subject: string;
    icalEvent: {
        method: "REQUEST" | "CANCEL";
        content: string;
        filename: string;
    };
    inviteTimeContext: InviteTimeContext;
    meetingUrl: string | null;
    hasValidMeetingUrl: boolean;
    counterpartName: string;
    textLines: string[];
};

function isValidAbsoluteHttpUrl(value: string | null | undefined): value is string {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

function getRoleSpecificMeetingUrl(booking: BookingWithRelations, role: CalendarInviteRecipientRole) {
    const roleSpecificMeetingUrl = (
        role === "CANDIDATE"
            ? booking.candidateZoomJoinUrl
            : booking.professionalZoomJoinUrl
    )?.trim() || null;

    return roleSpecificMeetingUrl || booking.zoomJoinUrl?.trim() || null;
}

function getDisplayName(user: User, fallbackLabel: string) {
    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return fullName || fallbackLabel;
}

function buildRequestSubject(booking: BookingWithRelations, role: CalendarInviteRecipientRole) {
    if (role === "PROFESSIONAL") {
        return `Kafei - Chat with ${getDisplayName(booking.candidate, "Candidate")}`;
    }

    const professionalExperiences = booking.professional.professionalProfile?.experience ?? [];
    const currentRole = deriveCurrentRoleFromExperiences(professionalExperiences);
    const hasCompleteRoleLabel = Boolean(currentRole.title && currentRole.employer);
    const roleLabel = hasCompleteRoleLabel
        ? `${currentRole.title} @ ${currentRole.employer}`
        : "Professional";

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
    method: InviteMethod;
    zoomInviteText: string;
    canonicalDateTime: string;
    canonicalTimezone: string;
    recipientDateTime: string;
    recipientTimezone: string;
}) {
    const counterpartName = role === "CANDIDATE"
        ? getDisplayName(booking.professional, "Professional")
        : getDisplayName(booking.candidate, "Candidate");

    const timeLine = method === "REQUEST"
        ? `Your Local Time (${recipientTimezone}): ${recipientDateTime}`
        : `Scheduled Time (${canonicalTimezone}): ${canonicalDateTime}`;

    return [
        zoomInviteText.trim(),
        "",
        timeLine,
        `Counterpart: ${counterpartName}`,
    ].join("\n");
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
    return {
        hours: Math.floor(durationMinutes / 60),
        minutes: durationMinutes % 60,
    };
}

function getCanonicalBookingTimezone(bookingTimezone: string | null | undefined) {
    return normalizeTimezone(bookingTimezone ?? "UTC");
}

function getRecipientTimezone(role: CalendarInviteRecipientRole, booking: BookingWithRelations) {
    const recipient = role === "CANDIDATE" ? booking.candidate : booking.professional;
    const recipientTimezone = typeof recipient.timezone === "string" ? recipient.timezone : null;
    return normalizeTimezone(recipientTimezone ?? booking.timezone);
}

function formatDateTimeForTimezone(date: Date, timezone: string) {
    return formatInTimeZone(date, timezone, "MMM d, yyyy 'at' h:mm a");
}

function buildInviteTimeContext(
    role: CalendarInviteRecipientRole,
    booking: BookingWithRelations,
    startDate: Date,
): InviteTimeContext {
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
    method: InviteMethod;
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
    const recipient = role === "CANDIDATE" ? booking.candidate : booking.professional;
    const inviteTimeContext = buildInviteTimeContext(role, booking, startDate);

    const eventResult = createEvent({
        uid,
        sequence,
        method,
        start: buildIcsStartDateArray(startDate),
        startInputType: "utc",
        startOutputType: "utc",
        endInputType: "utc",
        endOutputType: "utc",
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
        status: method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
        busyStatus: method === "CANCEL" ? "FREE" : "BUSY",
        organizer: { name: "Kafei Platform", email: getCalendarInviteOrganizerEmail() },
        attendees: [
            {
                name: getDisplayName(recipient, role === "CANDIDATE" ? "Candidate" : "Professional"),
                email: recipient.email,
                rsvp: true,
                partstat: method === "CANCEL" ? "DECLINED" : "NEEDS-ACTION",
                role: "REQ-PARTICIPANT",
            },
        ],
    });

    if (eventResult.error || !eventResult.value) {
        const reason = eventResult.error instanceof Error
            ? eventResult.error.message
            : String(eventResult.error || "unknown_error");
        throw new Error(`Failed to create calendar invite ICS: ${reason}`);
    }

    return {
        icsContent: eventResult.value,
        meetingUrl,
        hasValidMeetingUrl,
        inviteTimeContext,
    };
}

export function buildCalendarInviteRequestEmail(
    booking: BookingWithRelations,
    role: CalendarInviteRecipientRole,
    uid: string,
    sequence: number,
    zoomInviteText: string,
): BuiltCalendarInviteEmail {
    const subject = buildRequestSubject(booking, role);
    const recipientEmail = role === "CANDIDATE" ? booking.candidate.email : booking.professional.email;
    const { icsContent, meetingUrl, hasValidMeetingUrl, inviteTimeContext } = createCalendarInviteContent({
        booking,
        role,
        uid,
        sequence,
        method: "REQUEST",
        zoomInviteText,
        eventTitle: subject,
    });

    const counterpartName = role === "CANDIDATE"
        ? getDisplayName(booking.professional, "Professional")
        : getDisplayName(booking.candidate, "Candidate");

    return {
        recipientEmail,
        subject,
        icalEvent: {
            method: "REQUEST",
            content: icsContent,
            filename: "consultation.ics",
        },
        inviteTimeContext,
        meetingUrl,
        hasValidMeetingUrl,
        counterpartName,
        textLines: [
            "Please respond to the calendar invitation for your consultation call.",
            `Your Local Time (${inviteTimeContext.recipientTimezone}): ${inviteTimeContext.recipientDateTime}`,
            "Please use your calendar client's RSVP controls to accept or decline.",
        ],
    };
}

export function buildCalendarInviteCancelEmail(
    booking: BookingWithRelations,
    role: CalendarInviteRecipientRole,
    uid: string,
    sequence: number,
    zoomInviteText: string,
): BuiltCalendarInviteEmail {
    const recipientEmail = role === "CANDIDATE" ? booking.candidate.email : booking.professional.email;
    const { icsContent, meetingUrl, hasValidMeetingUrl, inviteTimeContext } = createCalendarInviteContent({
        booking,
        role,
        uid,
        sequence,
        method: "CANCEL",
        zoomInviteText,
        eventTitle: "Consultation Call",
    });

    const counterpartName = role === "CANDIDATE"
        ? getDisplayName(booking.professional, "Professional")
        : getDisplayName(booking.candidate, "Candidate");

    return {
        recipientEmail,
        subject: "Canceled: Consultation Call",
        icalEvent: {
            method: "CANCEL",
            content: icsContent,
            filename: "consultation-cancel.ics",
        },
        inviteTimeContext,
        meetingUrl,
        hasValidMeetingUrl,
        counterpartName,
        textLines: [
            "Your consultation call has been canceled.",
            `Scheduled Time (${inviteTimeContext.canonicalTimezone}): ${inviteTimeContext.canonicalDateTime}`,
            `Your Local Time (${inviteTimeContext.recipientTimezone}): ${inviteTimeContext.recipientDateTime}`,
        ],
    };
}
