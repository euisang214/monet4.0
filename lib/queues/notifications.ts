import { Worker, Job, ConnectionOptions } from 'bullmq';
import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';
import { notificationsQueue } from '@/lib/queues';
import { getZoomInvitationContent } from '@/lib/integrations/zoom';
import {
    sendFeedbackRevisionEmail,
    sendBookingRequestedEmail,
    sendBookingDeclinedEmail,
    sendPayoutReleasedEmail,
    sendCalendarInviteRequestEmail,
    sendCalendarInviteCancelEmail,
    type CalendarInviteRecipientRole,
} from '@/lib/integrations/email';

const CALENDAR_INVITE_RECIPIENT_ROLES: CalendarInviteRecipientRole[] = ['CANDIDATE', 'PROFESSIONAL'];

function isCalendarInviteRecipientRole(value: unknown): value is CalendarInviteRecipientRole {
    return value === 'CANDIDATE' || value === 'PROFESSIONAL';
}

function getRoleSpecificMeetingUrl(
    booking: {
        zoomJoinUrl: string | null;
        candidateZoomJoinUrl: string | null;
        professionalZoomJoinUrl: string | null;
    },
    recipientRole: CalendarInviteRecipientRole
) {
    return recipientRole === 'CANDIDATE'
        ? booking.candidateZoomJoinUrl || booking.zoomJoinUrl
        : booking.professionalZoomJoinUrl || booking.zoomJoinUrl;
}

function buildFallbackZoomInviteText(meetingUrl: string | null) {
    return [
        'Join Zoom Meeting',
        meetingUrl || 'Join link unavailable',
    ].join('\n');
}

async function buildZoomInviteText(
    booking: {
        id: string;
        zoomMeetingId: string | null;
        zoomJoinUrl: string | null;
        candidateZoomJoinUrl: string | null;
        professionalZoomJoinUrl: string | null;
    },
    recipientRole: CalendarInviteRecipientRole
) {
    const preferredJoinUrl = getRoleSpecificMeetingUrl(booking, recipientRole);
    if (!booking.zoomMeetingId) {
        return buildFallbackZoomInviteText(preferredJoinUrl);
    }

    try {
        const invitation = await getZoomInvitationContent({
            meetingId: booking.zoomMeetingId,
            preferredJoinUrl,
        });
        return invitation.text;
    } catch (error) {
        console.error('[NOTIFICATIONS] Falling back to generated Zoom invite text', {
            bookingId: booking.id,
            recipientRole,
            error: error instanceof Error ? error.message : String(error),
        });
        return buildFallbackZoomInviteText(preferredJoinUrl);
    }
}

async function fanOutCalendarInviteRequestJobs(bookingId: string, revisionKey: string) {
    await Promise.all(CALENDAR_INVITE_RECIPIENT_ROLES.map((recipientRole) => (
        notificationsQueue.add('notifications', {
            type: 'calendar_invite_request',
            bookingId,
            recipientRole,
            revisionKey,
        }, {
            jobId: `cal-req-${bookingId}-${recipientRole}-${revisionKey}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: true,
            removeOnFail: false,
        })
    )));
}

async function processCalendarInviteRequestJob({
    bookingId,
    recipientRole,
    revisionKey,
}: {
    bookingId: string;
    recipientRole: CalendarInviteRecipientRole;
    revisionKey?: string;
}) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { candidate: true, professional: true },
    });

    if (!booking) {
        console.error(`[NOTIFICATIONS] Booking ${bookingId} not found, cannot send calendar invite request.`);
        return 'skipped_not_found' as const;
    }

    const hasAnyZoomJoinUrl = Boolean(
        booking.zoomJoinUrl
        || booking.candidateZoomJoinUrl
        || booking.professionalZoomJoinUrl
    );

    if (booking.status !== BookingStatus.accepted || !hasAnyZoomJoinUrl) {
        console.warn(`[NOTIFICATIONS] Skipping calendar invite request for booking ${bookingId}: status=${booking.status}, zoomJoinUrl=${hasAnyZoomJoinUrl ? 'present' : 'missing'}`);
        return 'skipped_invalid_state' as const;
    }

    if (revisionKey && booking.zoomMeetingId && revisionKey !== booking.zoomMeetingId) {
        console.warn(`[NOTIFICATIONS] Skipping stale calendar invite request for booking ${bookingId}: revisionKey=${revisionKey}, zoomMeetingId=${booking.zoomMeetingId}`);
        return 'skipped_stale' as const;
    }

    const now = new Date();
    const zoomInviteText = await buildZoomInviteText(booking, recipientRole);

    if (recipientRole === 'CANDIDATE') {
        const uid = booking.candidateCalendarInviteUid || `${booking.id}.candidate@monet.ai`;
        const sequence = booking.candidateCalendarInviteSentAt
            ? booking.candidateCalendarInviteSequence + 1
            : booking.candidateCalendarInviteSequence;

        await sendCalendarInviteRequestEmail(booking, recipientRole, uid, sequence, zoomInviteText);
        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                candidateCalendarInviteUid: uid,
                candidateCalendarInviteSequence: sequence,
                candidateCalendarInviteSentAt: now,
                candidateCalendarInviteCancelledAt: null,
            },
        });
        return 'sent' as const;
    }

    const uid = booking.professionalCalendarInviteUid || `${booking.id}.professional@monet.ai`;
    const sequence = booking.professionalCalendarInviteSentAt
        ? booking.professionalCalendarInviteSequence + 1
        : booking.professionalCalendarInviteSequence;

    await sendCalendarInviteRequestEmail(booking, recipientRole, uid, sequence, zoomInviteText);
    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            professionalCalendarInviteUid: uid,
            professionalCalendarInviteSequence: sequence,
            professionalCalendarInviteSentAt: now,
            professionalCalendarInviteCancelledAt: null,
        },
    });
    return 'sent' as const;
}

async function processCalendarInviteCancelJob({
    bookingId,
    recipientRole,
}: {
    bookingId: string;
    recipientRole: CalendarInviteRecipientRole;
}) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { candidate: true, professional: true },
    });

    if (!booking) {
        console.error(`[NOTIFICATIONS] Booking ${bookingId} not found, cannot send calendar invite cancellation.`);
        return 'skipped_not_found' as const;
    }

    if (booking.status !== BookingStatus.cancelled) {
        console.warn(`[NOTIFICATIONS] Skipping calendar invite cancellation for booking ${bookingId}: status=${booking.status}`);
        return 'skipped_invalid_state' as const;
    }

    const now = new Date();
    const zoomInviteText = await buildZoomInviteText(booking, recipientRole);

    if (recipientRole === 'CANDIDATE') {
        if (!booking.candidateCalendarInviteUid) {
            console.warn(`[NOTIFICATIONS] Skipping candidate cancellation for booking ${bookingId}: no invite UID`);
            return 'skipped_missing_uid' as const;
        }

        const sequence = booking.candidateCalendarInviteSequence + 1;
        await sendCalendarInviteCancelEmail(
            booking,
            recipientRole,
            booking.candidateCalendarInviteUid,
            sequence,
            zoomInviteText
        );
        await prisma.booking.update({
            where: { id: bookingId },
            data: {
                candidateCalendarInviteSequence: sequence,
                candidateCalendarInviteCancelledAt: now,
            },
        });
        return 'sent' as const;
    }

    if (!booking.professionalCalendarInviteUid) {
        console.warn(`[NOTIFICATIONS] Skipping professional cancellation for booking ${bookingId}: no invite UID`);
        return 'skipped_missing_uid' as const;
    }

    const sequence = booking.professionalCalendarInviteSequence + 1;
    await sendCalendarInviteCancelEmail(
        booking,
        recipientRole,
        booking.professionalCalendarInviteUid,
        sequence,
        zoomInviteText
    );
    await prisma.booking.update({
        where: { id: bookingId },
        data: {
            professionalCalendarInviteSequence: sequence,
            professionalCalendarInviteCancelledAt: now,
        },
    });
    return 'sent' as const;
}

export function createNotificationsWorker(connection: ConnectionOptions) {
    const worker = new Worker('notifications', async (job: Job) => {
        console.log(`[NOTIFICATIONS] Processing job ${job.id}:`, job.name);

        const { type, bookingId, payoutId, reasons, recipientRole, revisionKey } = job.data as {
            type: string;
            bookingId?: string;
            payoutId?: string;
            reasons?: string[];
            recipientRole?: string;
            revisionKey?: string;
        };

        if (type === 'feedback_revise') {
            if (!bookingId) return;
            // 1. Fetch professional email
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true }
            });

            if (!booking) {
                console.error(`[NOTIFICATIONS] Booking ${bookingId} not found, cannot send email.`);
                return;
            }

            const email = booking.professional.email;

            // 2. Send Email
            await sendFeedbackRevisionEmail(email, bookingId, reasons || ['Quality standards not met.']);

            console.log(`[NOTIFICATIONS] Sent revision email to ${email} for booking ${bookingId}`);
        }
        else if (type === 'booking_requested') {
            if (!bookingId) return;
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true, candidate: true }
            });
            if (!booking) return;

            await sendBookingRequestedEmail(booking, booking.professional.email);
            console.log(`[NOTIFICATIONS] Sent booking request email to ${booking.professional.email}`);
        }
        else if (type === 'booking_accepted') {
            if (!bookingId) return;
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true, candidate: true }
            });
            if (!booking) return;

            const hasAnyZoomJoinUrl = Boolean(
                booking.zoomJoinUrl
                || booking.candidateZoomJoinUrl
                || booking.professionalZoomJoinUrl
            );

            if (booking.status !== BookingStatus.accepted || !hasAnyZoomJoinUrl) {
                console.warn(`[NOTIFICATIONS] Skipping acceptance invite fan-out for booking ${bookingId}: status=${booking.status}, zoomJoinUrl=${hasAnyZoomJoinUrl ? 'present' : 'missing'}`);
                return;
            }

            // Backward-compatibility shim for older queued jobs.
            await fanOutCalendarInviteRequestJobs(bookingId, booking.zoomMeetingId || 'manual');
            console.log(`[NOTIFICATIONS] Fanned out calendar invite request jobs for booking ${bookingId}`);
        }
        else if (type === 'calendar_invite_request') {
            if (!bookingId || !isCalendarInviteRecipientRole(recipientRole)) {
                console.error('[NOTIFICATIONS] Invalid calendar_invite_request payload', { bookingId, recipientRole });
                return;
            }
            const requestResult = await processCalendarInviteRequestJob({ bookingId, recipientRole, revisionKey });
            if (requestResult === 'sent') {
                console.log(`[NOTIFICATIONS] Sent calendar invite request for ${recipientRole} on booking ${bookingId}`);
            } else {
                console.log(`[NOTIFICATIONS] Calendar invite request not sent for ${recipientRole} on booking ${bookingId}: ${requestResult}`);
            }
        }
        else if (type === 'calendar_invite_cancel') {
            if (!bookingId || !isCalendarInviteRecipientRole(recipientRole)) {
                console.error('[NOTIFICATIONS] Invalid calendar_invite_cancel payload', { bookingId, recipientRole });
                return;
            }
            const cancelResult = await processCalendarInviteCancelJob({ bookingId, recipientRole });
            if (cancelResult === 'sent') {
                console.log(`[NOTIFICATIONS] Sent calendar invite cancellation for ${recipientRole} on booking ${bookingId}`);
            } else {
                console.log(`[NOTIFICATIONS] Calendar invite cancellation not sent for ${recipientRole} on booking ${bookingId}: ${cancelResult}`);
            }
        }
        else if (type === 'booking_declined') {
            if (!bookingId) return;
            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: { professional: true, candidate: true }
            });
            if (!booking) return;

            await sendBookingDeclinedEmail(booking);
            console.log(`[NOTIFICATIONS] Sent decline email to ${booking.candidate.email}`);
        }
        else if (type === 'payout_released') {
            if (!payoutId) return;
            const payout = await prisma.payout.findUnique({
                where: { id: payoutId },
                include: { booking: { include: { professional: true } } }
            });

            if (payout) {
                const professionalEmail = payout.booking.professional.email;
                await sendPayoutReleasedEmail(payout, professionalEmail);
                console.log(`[NOTIFICATIONS] Sent payout released email to ${professionalEmail}`);
            }
        }

        return { processed: true };
    }, {
        connection,
        concurrency: 10,
    });

    worker.on('completed', (job) => {
        console.log(`[NOTIFICATIONS] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[NOTIFICATIONS] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}
