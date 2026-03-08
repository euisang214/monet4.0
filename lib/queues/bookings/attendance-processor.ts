import { subDays } from 'date-fns';
import { prisma } from '@/lib/core/db';
import {
    ZOOM_ATTENDANCE_EVENT_RETENTION_DAYS,
    isZoomParticipantJoinedEvent,
    parseZoomAttendancePayload,
    type ZoomWebhookBody,
} from '@/lib/integrations/zoom-attendance';
import {
    determineParticipantMapping,
    type MappedRole,
    type MappingMethod,
    recordBookingAudit,
} from '@/lib/queues/bookings/processor-shared';

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
