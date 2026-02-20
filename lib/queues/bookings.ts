import { Worker, Job, ConnectionOptions } from 'bullmq';
import { prisma } from '@/lib/core/db';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { createGoogleCalendarEvent } from '@/lib/integrations/calendar/google';
import { expireBooking, completeCall, cancelBooking, initiateDispute, completeIntegrations } from '@/lib/domain/bookings/transitions';
import { stripe, cancelPaymentIntent } from '@/lib/integrations/stripe';
import { subMinutes } from 'date-fns';
import { BookingStatus, AttendanceOutcome } from '@prisma/client';

export const BOOKING_QUEUE_NAME = 'bookings';

export function createBookingsWorker(connection: ConnectionOptions) {
    const worker = new Worker(BOOKING_QUEUE_NAME, async (job: Job) => {
        console.log(`[BOOKINGS] Processing job ${job.id}:`, job.name);

        try {
            if (job.name === 'confirm-booking') {
                return await processConfirmBooking(job.data.bookingId);
            }
            if (job.name === 'reschedule-booking') {
                return await processRescheduleBooking(job.data.bookingId, job.data.oldZoomMeetingId);
            }
            if (job.name === 'expiry-check') {
                return await processExpiryCheck();
            }
            if (job.name === 'no-show-check') {
                return await processNoShowCheck();
            }
        } catch (error: any) {
            console.error(`[BOOKINGS] Job ${job.id} failed:`, error);
            throw error;
        }

        return { processed: true };
    }, {
        connection,
        concurrency: 5,
    });

    worker.on('completed', (job) => {
        console.log(`[BOOKINGS] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[BOOKINGS] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}

export async function processConfirmBooking(bookingId: string) {
    // 1. Fetch Booking
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            candidate: true,
            professional: true,
            // professionalProfile: true, // Optional if needed for deeper details
        },
    });

    if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
    }

    if (!booking.startAt || !booking.endAt) {
        throw new Error(`Booking ${bookingId} missing start/end time`);
    }

    // 2. Create Zoom Meeting
    // We only create if not already exists (idempotency check)
    let zoomMeetingId = booking.zoomMeetingId;
    let zoomJoinUrl = booking.zoomJoinUrl;

    if (
        zoomMeetingId
        && zoomJoinUrl
        && (
            booking.status === BookingStatus.accepted_pending_integrations
            || booking.status === BookingStatus.accepted
        )
    ) {
        // Self-heal transition state and (re)emit accepted notifications in an idempotent way.
        await completeIntegrations(bookingId, { joinUrl: zoomJoinUrl, meetingId: zoomMeetingId });
    }

    if (!zoomMeetingId) {
        try {
            const durationMinutes = (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60);

            const meeting = await createZoomMeeting({
                topic: `Consultation: Professional & Candidate`,
                start_time: booking.startAt,
                duration: durationMinutes,
                timezone: 'UTC',
            });

            zoomMeetingId = meeting.id.toString();
            zoomJoinUrl = meeting.join_url;

            // Transition booking status via centralized state machine
            await completeIntegrations(bookingId, { joinUrl: zoomJoinUrl, meetingId: zoomMeetingId });

            // Refetch booking to ensure downstream has latest status/URLs if we passed strictly objects
            // But we have local vars.
        } catch (error) {
            console.error(`Failed to create Zoom meeting for booking ${bookingId}`, error);
            // We throw to retry the job
            throw error;
        }
    }

    if (booking.status === BookingStatus.accepted_pending_integrations && (Boolean(zoomMeetingId) !== Boolean(zoomJoinUrl))) {
        throw new Error(`Booking ${bookingId} has incomplete Zoom metadata`);
    }

    // 3. Google Calendar Sync
    // We do not fail the job if this fails, as per plan.
    const eventParams = {
        summary: `Consultation Call`,
        description: `Join Zoom Meeting: ${zoomJoinUrl}`,
        location: zoomJoinUrl || undefined,
        start: booking.startAt,
        end: booking.endAt,
        attendees: [booking.candidate.email, booking.professional.email],
    };

    // Sync to Professional
    try {
        await createGoogleCalendarEvent({
            userId: booking.professionalId,
            ...eventParams,
            description: `${eventParams.description}\n\nClient: ${booking.candidate.email}`,
        });
    } catch (e) {
        console.error(`Failed to sync calendar for professional ${booking.professionalId}`, e);
    }

    // Sync to Candidate
    try {
        await createGoogleCalendarEvent({
            userId: booking.candidateId,
            ...eventParams,
            description: `${eventParams.description}\n\nProfessional: ${booking.professional.email}`,
        });
    } catch (e) {
        console.error(`Failed to sync calendar for candidate ${booking.candidateId}`, e);
    }

    return { processed: true, bookingId, zoomCreated: !!zoomJoinUrl };
}

export async function processRescheduleBooking(bookingId: string, oldZoomMeetingId?: string) {
    // 1. Delete Old Zoom Meeting
    if (oldZoomMeetingId) {
        // Dynamic import to avoid circular dependency issues if any, though imports seem fine.
        const { deleteZoomMeeting } = await import('@/lib/integrations/zoom');
        try {
            await deleteZoomMeeting(oldZoomMeetingId);
            console.log(`Deleted old Zoom meeting ${oldZoomMeetingId}`);
        } catch (error) {
            console.error(`Failed to delete old Zoom meeting ${oldZoomMeetingId}`, error);
            // Non-blocking, continue to create new one
        }
    }

    // 2. Process as a new confirmation (Create Zoom, Sync Calendar, Send Emails)
    // We can reuse processConfirmBooking logic, but we need to ensure idempotency.
    // processConfirmBooking checks if zoomMeetingId is already set. 
    // Since we cleared it (or transitioned state) in the caller? 
    // Wait, the plan says "Update DB with new Zoom details".
    // If we reuse processConfirmBooking:
    // It checks `if (!booking.zoomMeetingId)`. 
    // If the transition cleared `zoomMeetingId`, it will create a new one.
    // Let's verify if confirmReschedule clears it. It does NOT in transitions.
    // So we must handle it here.

    // We update the DB to clear the OLD meeting ID locally before calling processConfirmBooking?
    // Or we implement specific logic here.
    // Reusing processConfirmBooking is risky if it assumes "first time".
    // Better to implement specific reschedule logic which forces new Zoom creation.

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { candidate: true, professional: true }
    });

    if (!booking) throw new Error('Booking not found');
    if (!booking.startAt || !booking.endAt) throw new Error('Booking missing time');

    // Create NEW Zoom Meeting (ignoring if one exists in DB, we overwrite)
    // Actually, we should check checks.

    let zoomMeetingId: string | null = null;
    let zoomJoinUrl: string | null = null;

    try {
        const durationMinutes = (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60);
        const meeting = await createZoomMeeting({
            topic: `Rescheduled Consultation: Professional & Candidate`,
            start_time: booking.startAt,
            duration: durationMinutes,
            timezone: 'UTC',
        });

        zoomMeetingId = meeting.id.toString();
        zoomJoinUrl = meeting.join_url;

        // Transition booking status via centralized state machine
        await completeIntegrations(bookingId, { joinUrl: zoomJoinUrl, meetingId: zoomMeetingId });
    } catch (error) {
        console.error(`Failed to create new Zoom meeting for reschedule ${bookingId}`, error);
        throw error;
    }

    // Reuse calendar sync logic
    const eventParams = {
        summary: `Rescheduled Consultation Call`,
        description: `Join Zoom Meeting: ${zoomJoinUrl}`,
        location: zoomJoinUrl || undefined,
        start: booking.startAt,
        end: booking.endAt,
        attendees: [booking.candidate.email, booking.professional.email],
    };

    // Sync to Professional
    await createGoogleCalendarEvent({
        userId: booking.professionalId,
        ...eventParams,
        description: `${eventParams.description}\n\nClient: ${booking.candidate.email}`,
    }).catch(e => console.error(e));

    // Sync to Candidate
    await createGoogleCalendarEvent({
        userId: booking.candidateId,
        ...eventParams,
        description: `${eventParams.description}\n\nProfessional: ${booking.professional.email}`,
    }).catch(e => console.error(e));

    return { processed: true, type: 'reschedule' };
}

export async function processExpiryCheck() {
    console.log('[BOOKINGS] Processing Expiry Check');

    // Find requested bookings that have expired
    const expiredBookings = await prisma.booking.findMany({
        where: {
            status: BookingStatus.requested,
            expiresAt: { lt: new Date() },
        },
        include: { payment: true },
        take: 50, // Batch limit
    });

    console.log(`[BOOKINGS] Found ${expiredBookings.length} bookings to expire`);

    for (const booking of expiredBookings) {
        try {
            console.log(`[BOOKINGS] Expiring booking ${booking.id}`);

            // 1. Release Stripe Authorization (if exists)
            if (booking.payment?.stripePaymentIntentId) {
                try {
                    await cancelPaymentIntent(booking.payment.stripePaymentIntentId);
                    console.log(`[BOOKINGS] Cancelled PI ${booking.payment.stripePaymentIntentId}`);
                } catch (err: any) {
                    if (err.code === 'resource_missing') {
                        console.warn(`[BOOKINGS] PI ${booking.payment.stripePaymentIntentId} not found or already cancelled.`);
                    } else if (err.code === 'payment_intent_unexpected_state') {
                        console.warn(`[BOOKINGS] PI ${booking.payment.stripePaymentIntentId} in unexpected state: ${err.message}`);
                        // If already canceled, we proceed. If captured, that's an issue.
                    } else {
                        console.error(`[BOOKINGS] Failed to cancel PI for booking ${booking.id}`, err);
                        // We continue to expire DB record to prevent zombie state, 
                        // but logging is critical. 
                    }
                }
            }

            // 2. Transition State
            await expireBooking(booking.id);

        } catch (error) {
            console.error(`[BOOKINGS] Failed to expire booking ${booking.id}`, error);
        }
    }

    return { processed: true, count: expiredBookings.length };
}

export async function processNoShowCheck() {
    console.log('[BOOKINGS] Processing No-Show Check');

    // Find accepted bookings that started > 15 mins ago and have no attendance outcome
    // 15 minute grace period
    const gracePeriodThreshold = subMinutes(new Date(), 15);

    const staleBookings = await prisma.booking.findMany({
        where: {
            status: BookingStatus.accepted,
            startAt: { lt: gracePeriodThreshold },
            attendanceOutcome: null,
        },
        include: { payment: true }, // Not strictly needed unless checking something
        take: 50,
    });

    console.log(`[BOOKINGS] Found ${staleBookings.length} potential no-show bookings`);

    for (const booking of staleBookings) {
        try {
            // Check join timestamps
            const candidateJoined = !!booking.candidateJoinedAt;
            const proJoined = !!booking.professionalJoinedAt;

            if (candidateJoined && proJoined) {
                // Both joined: Complete the call
                console.log(`[BOOKINGS] Both joined for ${booking.id}. Completing.`);
                await completeCall(booking.id, { attendanceOutcome: AttendanceOutcome.both_joined });
            } else if (!candidateJoined && !proJoined) {
                // Both missing: Dispute/Manual Review required? 
                // CLAUDE.md: "Handle both no-show: Create admin task for manual review... Funds remain held"
                // -> Initiate Dispute (reason: other/no_show)
                console.log(`[BOOKINGS] Both No-Show for ${booking.id}. Initiating Dispute.`);
                await initiateDispute(booking.id, { userId: 'system', role: 'ADMIN' }, 'no_show', 'Automated: Both parties failed to join.');
            } else if (!candidateJoined && proJoined) {
                // Candidate No-Show: Late Cancellation (Pro gets paid)
                console.log(`[BOOKINGS] Candidate No-Show for ${booking.id}. Late Cancellation.`);
                // 'system' actor, reason, options
                await cancelBooking(booking.id, 'system', 'Automated: Candidate No-Show', { attendanceOutcome: AttendanceOutcome.candidate_no_show });
            } else if (candidateJoined && !proJoined) {
                // Professional No-Show: Dispute (Pro penalized, likely refund/reschedule)
                console.log(`[BOOKINGS] Professional No-Show for ${booking.id}. Initiating Dispute.`);
                await initiateDispute(booking.id, { userId: 'system', role: 'ADMIN' }, 'no_show', 'Automated: Professional failed to join.');
            }

        } catch (error) {
            console.error(`[BOOKINGS] Failed to process no-show for booking ${booking.id}`, error);
        }
    }

    return { processed: true, count: staleBookings.length };
}
