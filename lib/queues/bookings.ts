import { Worker, Job, ConnectionOptions } from 'bullmq';
import { prisma } from '@/lib/core/db';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { createGoogleCalendarEvent } from '@/lib/integrations/calendar/google';
import { expireBooking, completeCall, cancelBooking, initiateDispute, completeIntegrations } from '@/lib/domain/bookings/transitions';
import { cancelPaymentIntent } from '@/lib/integrations/stripe';
import { subDays } from 'date-fns';
import { BookingStatus, AttendanceOutcome, Prisma } from '@prisma/client';
import {
    ZOOM_ATTENDANCE_ENFORCEMENT,
    ZOOM_ATTENDANCE_EVENT_RETENTION_DAYS,
    ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES,
    ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES,
    isZoomParticipantJoinedEvent,
    normalizeEmail,
    parseZoomAttendancePayload,
    type ZoomWebhookBody,
} from '@/lib/integrations/zoom-attendance';
import { createAuditLog } from '@/lib/shared/audit';

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
            if (job.name === 'zoom-attendance-event') {
                return await processZoomAttendanceEvent(job.data.zoomAttendanceEventId);
            }
            if (job.name === 'zoom-attendance-retention') {
                return await processZoomAttendanceRetention();
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

type AttendanceRecommendation = 'both_joined' | 'candidate_no_show' | 'professional_no_show' | 'both_no_show' | 'ambiguous';
type MappedRole = 'candidate' | 'professional' | 'unknown';
type MappingMethod = 'registrant_id' | 'strict_email' | 'unknown';

async function recordBookingAudit(bookingId: string, action: string, metadata: Record<string, unknown>) {
    await prisma.$transaction(async (tx) => {
        await createAuditLog(tx, 'Booking', bookingId, action, null, metadata as Prisma.InputJsonValue);
    });
}

function getAttendanceMinutesFromStart(startAt: Date, now: Date) {
    return Math.floor((now.getTime() - startAt.getTime()) / (60 * 1000));
}

function determineParticipantMapping({
    participantEmail,
    participantRegistrantId,
    candidateEmail,
    professionalEmail,
    candidateRegistrantId,
    professionalRegistrantId,
}: {
    participantEmail: string | null;
    participantRegistrantId: string | null;
    candidateEmail: string;
    professionalEmail: string;
    candidateRegistrantId: string | null;
    professionalRegistrantId: string | null;
}): { mappedRole: MappedRole; mappingMethod: MappingMethod } {
    if (participantRegistrantId) {
        if (candidateRegistrantId && participantRegistrantId === candidateRegistrantId) {
            return { mappedRole: 'candidate', mappingMethod: 'registrant_id' };
        }
        if (professionalRegistrantId && participantRegistrantId === professionalRegistrantId) {
            return { mappedRole: 'professional', mappingMethod: 'registrant_id' };
        }
    }

    const normalizedParticipantEmail = normalizeEmail(participantEmail);
    const normalizedCandidateEmail = normalizeEmail(candidateEmail);
    const normalizedProfessionalEmail = normalizeEmail(professionalEmail);

    if (normalizedParticipantEmail && normalizedCandidateEmail && normalizedParticipantEmail === normalizedCandidateEmail) {
        return { mappedRole: 'candidate', mappingMethod: 'strict_email' };
    }
    if (normalizedParticipantEmail && normalizedProfessionalEmail && normalizedParticipantEmail === normalizedProfessionalEmail) {
        return { mappedRole: 'professional', mappingMethod: 'strict_email' };
    }

    return { mappedRole: 'unknown', mappingMethod: 'unknown' };
}

async function applyFinalNoShowDecision({
    booking,
    candidateJoined,
    professionalJoined,
    hasUnknownJoinEvidence,
}: {
    booking: {
        id: string;
        candidateId: string;
    };
    candidateJoined: boolean;
    professionalJoined: boolean;
    hasUnknownJoinEvidence: boolean;
}) {
    if (candidateJoined && professionalJoined) {
        await completeCall(booking.id, { attendanceOutcome: AttendanceOutcome.both_joined });
        return 'both_joined' as AttendanceRecommendation;
    }

    if (hasUnknownJoinEvidence) {
        await initiateDispute(
            booking.id,
            { userId: booking.candidateId, role: 'CANDIDATE' },
            'no_show',
            'Automated no-show decision (automated=true,outcome=both_no_show): Ambiguous attendance evidence from Zoom events.',
            undefined,
            { attendanceOutcome: AttendanceOutcome.both_no_show }
        );
        return 'ambiguous' as AttendanceRecommendation;
    }

    if (!candidateJoined && professionalJoined) {
        await cancelBooking(
            booking.id,
            'system',
            'Automated: Candidate No-Show',
            { attendanceOutcome: AttendanceOutcome.candidate_no_show }
        );
        return 'candidate_no_show' as AttendanceRecommendation;
    }

    if (candidateJoined && !professionalJoined) {
        await initiateDispute(
            booking.id,
            { userId: booking.candidateId, role: 'CANDIDATE' },
            'no_show',
            'Automated no-show decision (automated=true,outcome=professional_no_show): Professional failed to join.',
            undefined,
            { attendanceOutcome: AttendanceOutcome.professional_no_show }
        );
        return 'professional_no_show' as AttendanceRecommendation;
    }

    await initiateDispute(
        booking.id,
        { userId: booking.candidateId, role: 'CANDIDATE' },
        'no_show',
        'Automated no-show decision (automated=true,outcome=both_no_show): Both parties failed to join.',
        undefined,
        { attendanceOutcome: AttendanceOutcome.both_no_show }
    );
    return 'both_no_show' as AttendanceRecommendation;
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
    let candidateZoomJoinUrl = booking.candidateZoomJoinUrl;
    let professionalZoomJoinUrl = booking.professionalZoomJoinUrl;
    let candidateZoomRegistrantId = booking.candidateZoomRegistrantId;
    let professionalZoomRegistrantId = booking.professionalZoomRegistrantId;

    if (
        zoomMeetingId
        && zoomJoinUrl
        && (
            booking.status === BookingStatus.accepted_pending_integrations
            || booking.status === BookingStatus.accepted
        )
    ) {
        // Self-heal transition state and (re)emit accepted notifications in an idempotent way.
        await completeIntegrations(bookingId, {
            joinUrl: zoomJoinUrl,
            meetingId: zoomMeetingId,
            candidateJoinUrl: candidateZoomJoinUrl,
            professionalJoinUrl: professionalZoomJoinUrl,
            candidateRegistrantId: candidateZoomRegistrantId,
            professionalRegistrantId: professionalZoomRegistrantId,
        });
    }

    if (!zoomMeetingId) {
        try {
            const durationMinutes = (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60);

            const meeting = await createZoomMeeting({
                topic: `Consultation: Professional & Candidate`,
                start_time: booking.startAt,
                duration: durationMinutes,
                timezone: 'UTC',
                candidateEmail: booking.candidate.email,
                professionalEmail: booking.professional.email,
                candidateName: booking.candidate.email,
                professionalName: booking.professional.email,
            });

            zoomMeetingId = meeting.id.toString();
            zoomJoinUrl = meeting.join_url;
            candidateZoomJoinUrl = meeting.candidate_join_url;
            professionalZoomJoinUrl = meeting.professional_join_url;
            candidateZoomRegistrantId = meeting.candidate_registrant_id;
            professionalZoomRegistrantId = meeting.professional_registrant_id;

            // Transition booking status via centralized state machine
            await completeIntegrations(bookingId, {
                joinUrl: zoomJoinUrl,
                meetingId: zoomMeetingId,
                candidateJoinUrl: candidateZoomJoinUrl,
                professionalJoinUrl: professionalZoomJoinUrl,
                candidateRegistrantId: candidateZoomRegistrantId,
                professionalRegistrantId: professionalZoomRegistrantId,
            });

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
    let candidateZoomJoinUrl: string | null = null;
    let professionalZoomJoinUrl: string | null = null;
    let candidateZoomRegistrantId: string | null = null;
    let professionalZoomRegistrantId: string | null = null;

    try {
        const durationMinutes = (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60);
        const meeting = await createZoomMeeting({
            topic: `Rescheduled Consultation: Professional & Candidate`,
            start_time: booking.startAt,
            duration: durationMinutes,
            timezone: 'UTC',
            candidateEmail: booking.candidate.email,
            professionalEmail: booking.professional.email,
            candidateName: booking.candidate.email,
            professionalName: booking.professional.email,
        });

        zoomMeetingId = meeting.id.toString();
        zoomJoinUrl = meeting.join_url;
        candidateZoomJoinUrl = meeting.candidate_join_url;
        professionalZoomJoinUrl = meeting.professional_join_url;
        candidateZoomRegistrantId = meeting.candidate_registrant_id;
        professionalZoomRegistrantId = meeting.professional_registrant_id;

        // Transition booking status via centralized state machine
        await completeIntegrations(bookingId, {
            joinUrl: zoomJoinUrl,
            meetingId: zoomMeetingId,
            candidateJoinUrl: candidateZoomJoinUrl,
            professionalJoinUrl: professionalZoomJoinUrl,
            candidateRegistrantId: candidateZoomRegistrantId,
            professionalRegistrantId: professionalZoomRegistrantId,
        });
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

export async function processZoomAttendanceEvent(zoomAttendanceEventId: string) {
    const attendanceEvent = await prisma.zoomAttendanceEvent.findUnique({
        where: { id: zoomAttendanceEventId },
    });

    if (!attendanceEvent) {
        return { processed: false, reason: 'event_not_found', zoomAttendanceEventId };
    }

    if (attendanceEvent.processingStatus === 'processed') {
        return { processed: true, skipped: true, reason: 'already_processed', zoomAttendanceEventId };
    }

    const payload = attendanceEvent.payload as unknown as ZoomWebhookBody;
    const parsedPayload = parseZoomAttendancePayload(payload);
    const meetingId = attendanceEvent.meetingId || parsedPayload.meetingId;

    if (!meetingId) {
        await prisma.zoomAttendanceEvent.update({
            where: { id: attendanceEvent.id },
            data: {
                processingStatus: 'failed',
                processingError: 'missing_meeting_id',
                processedAt: new Date(),
            },
        });
        return { processed: false, reason: 'missing_meeting_id', zoomAttendanceEventId };
    }

    const booking = await prisma.booking.findFirst({
        where: { zoomMeetingId: meetingId },
        select: {
            id: true,
            candidateId: true,
            professionalId: true,
            candidateJoinedAt: true,
            professionalJoinedAt: true,
            candidateZoomRegistrantId: true,
            professionalZoomRegistrantId: true,
            candidate: {
                select: {
                    email: true,
                },
            },
            professional: {
                select: {
                    email: true,
                },
            },
        },
    });

    let mappedRole: MappedRole = 'unknown';
    let mappingMethod: MappingMethod = 'unknown';
    let bookingId: string | null = null;

    if (booking) {
        bookingId = booking.id;
        const mapping = determineParticipantMapping({
            participantEmail: parsedPayload.participantEmail,
            participantRegistrantId: parsedPayload.participantRegistrantId,
            candidateEmail: booking.candidate.email,
            professionalEmail: booking.professional.email,
            candidateRegistrantId: booking.candidateZoomRegistrantId,
            professionalRegistrantId: booking.professionalZoomRegistrantId,
        });
        mappedRole = mapping.mappedRole;
        mappingMethod = mapping.mappingMethod;

        if (isZoomParticipantJoinedEvent(attendanceEvent.eventType) && mappedRole !== 'unknown') {
            const updates: {
                candidateJoinedAt?: Date;
                professionalJoinedAt?: Date;
            } = {};

            if (mappedRole === 'candidate') {
                if (!booking.candidateJoinedAt || attendanceEvent.eventTs < booking.candidateJoinedAt) {
                    updates.candidateJoinedAt = attendanceEvent.eventTs;
                }
            }

            if (mappedRole === 'professional') {
                if (!booking.professionalJoinedAt || attendanceEvent.eventTs < booking.professionalJoinedAt) {
                    updates.professionalJoinedAt = attendanceEvent.eventTs;
                }
            }

            if (updates.candidateJoinedAt || updates.professionalJoinedAt) {
                await prisma.booking.update({
                    where: { id: booking.id },
                    data: updates,
                });
            }
        }

        await recordBookingAudit(booking.id, 'attendance:zoom_event_processed', {
            eventId: attendanceEvent.id,
            eventType: attendanceEvent.eventType,
            mappedRole,
            mappingMethod,
            participantEmail: parsedPayload.participantEmail,
            participantId: parsedPayload.participantId,
            participantUserId: parsedPayload.participantUserId,
            participantRegistrantId: parsedPayload.participantRegistrantId,
            eventTs: attendanceEvent.eventTs.toISOString(),
        });
    }

    await prisma.zoomAttendanceEvent.update({
        where: { id: attendanceEvent.id },
        data: {
            bookingId,
            mappedRole,
            mappingMethod,
            processingStatus: booking ? 'processed' : 'ignored',
            processingError: booking ? null : 'booking_not_found_for_meeting',
            processedAt: new Date(),
        },
    });

    return {
        processed: true,
        zoomAttendanceEventId,
        bookingId,
        mappedRole,
        mappingMethod,
    };
}

export async function processZoomAttendanceRetention() {
    const cutoff = subDays(new Date(), ZOOM_ATTENDANCE_EVENT_RETENTION_DAYS);
    const deleted = await prisma.zoomAttendanceEvent.deleteMany({
        where: {
            createdAt: {
                lt: cutoff,
            },
        },
    });

    return {
        processed: true,
        deletedCount: deleted.count,
        cutoff: cutoff.toISOString(),
    };
}

export async function processNoShowCheck() {
    console.log('[BOOKINGS] Processing No-Show Check');

    const now = new Date();
    const initialThreshold = new Date(now.getTime() - ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES * 60 * 1000);

    const staleBookings = await prisma.booking.findMany({
        where: {
            status: BookingStatus.accepted,
            startAt: { lt: initialThreshold },
            attendanceOutcome: null,
        },
        include: { payment: true },
        take: 50,
    });

    console.log(`[BOOKINGS] Found ${staleBookings.length} potential no-show bookings`);
    const failedBookingIds: string[] = [];

    for (const booking of staleBookings) {
        try {
            if (!booking.startAt) {
                continue;
            }

            const minutesFromStart = getAttendanceMinutesFromStart(booking.startAt, now);
            // Check join timestamps
            const candidateJoined = !!booking.candidateJoinedAt;
            const proJoined = !!booking.professionalJoinedAt;
            const isFinalCheck = minutesFromStart >= ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES;

            if (candidateJoined && proJoined) {
                const recommendation: AttendanceRecommendation = 'both_joined';
                if (ZOOM_ATTENDANCE_ENFORCEMENT) {
                    await completeCall(booking.id, { attendanceOutcome: AttendanceOutcome.both_joined });
                    await recordBookingAudit(booking.id, 'attendance:no_show_decision', {
                        phase: isFinalCheck ? 'final' : 'initial',
                        recommendation,
                        applied: recommendation,
                        enforcementEnabled: true,
                        minutesFromStart,
                    });
                } else {
                    await recordBookingAudit(booking.id, 'attendance:no_show_decision', {
                        phase: isFinalCheck ? 'final' : 'initial',
                        recommendation,
                        applied: 'skipped_due_to_kill_switch',
                        enforcementEnabled: false,
                        minutesFromStart,
                    });
                }
                continue;
            }

            if (!isFinalCheck) {
                await recordBookingAudit(booking.id, 'attendance:no_show_decision', {
                    phase: 'initial',
                    recommendation: 'pending_final_check',
                    applied: 'none',
                    enforcementEnabled: ZOOM_ATTENDANCE_ENFORCEMENT,
                    minutesFromStart,
                    candidateJoined,
                    professionalJoined: proJoined,
                });
                continue;
            }

            const unknownEvidenceWindowStart = new Date(
                booking.startAt.getTime() - ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES * 60 * 1000
            );
            const hasUnknownJoinEvidence = (await prisma.zoomAttendanceEvent.count({
                where: {
                    bookingId: booking.id,
                    eventType: 'meeting.participant_joined',
                    mappedRole: 'unknown',
                    eventTs: { gte: unknownEvidenceWindowStart },
                },
            })) > 0;

            const recommendation: AttendanceRecommendation = (() => {
                if (hasUnknownJoinEvidence) return 'ambiguous';
                if (!candidateJoined && proJoined) return 'candidate_no_show';
                if (candidateJoined && !proJoined) return 'professional_no_show';
                return 'both_no_show';
            })();

            if (!ZOOM_ATTENDANCE_ENFORCEMENT) {
                await recordBookingAudit(booking.id, 'attendance:no_show_decision', {
                    phase: 'final',
                    recommendation,
                    applied: 'skipped_due_to_kill_switch',
                    enforcementEnabled: false,
                    minutesFromStart,
                    candidateJoined,
                    professionalJoined: proJoined,
                    hasUnknownJoinEvidence,
                });
                continue;
            }

            const applied = await applyFinalNoShowDecision({
                booking: { id: booking.id, candidateId: booking.candidateId },
                candidateJoined,
                professionalJoined: proJoined,
                hasUnknownJoinEvidence,
            });

            await recordBookingAudit(booking.id, 'attendance:no_show_decision', {
                phase: 'final',
                recommendation,
                applied,
                enforcementEnabled: true,
                minutesFromStart,
                candidateJoined,
                professionalJoined: proJoined,
                hasUnknownJoinEvidence,
            });
        } catch (error) {
            console.error(`[BOOKINGS] Failed to process no-show for booking ${booking.id}`, error);
            failedBookingIds.push(booking.id);
        }
    }

    return { processed: true, count: staleBookings.length, failedBookingIds };
}
