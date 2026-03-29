import { BookingStatus } from '@prisma/client';
import { prisma } from '@/lib/core/db';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { completeIntegrations } from '@/lib/domain/bookings/transitions';

export async function processConfirmBooking(bookingId: string) {
    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            candidate: true,
            professional: true,
        },
    });

    if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
    }

    if (!booking.startAt || !booking.endAt) {
        throw new Error(`Booking ${bookingId} missing start/end time`);
    }

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
                topic: 'Consultation: Professional & Candidate',
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

            await completeIntegrations(bookingId, {
                joinUrl: zoomJoinUrl,
                meetingId: zoomMeetingId,
                candidateJoinUrl: candidateZoomJoinUrl,
                professionalJoinUrl: professionalZoomJoinUrl,
                candidateRegistrantId: candidateZoomRegistrantId,
                professionalRegistrantId: professionalZoomRegistrantId,
            });
        } catch (error) {
            console.error(`Failed to create Zoom meeting for booking ${bookingId}`, error);
            throw error;
        }
    }

    if (booking.status === BookingStatus.accepted_pending_integrations && (Boolean(zoomMeetingId) !== Boolean(zoomJoinUrl))) {
        throw new Error(`Booking ${bookingId} has incomplete Zoom metadata`);
    }

    return { processed: true, bookingId, zoomCreated: !!zoomJoinUrl };
}
