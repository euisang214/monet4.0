import { prisma } from '@/lib/core/db';
import { createZoomMeeting } from '@/lib/integrations/zoom';
import { completeIntegrations } from '@/lib/domain/bookings/transitions';

export async function processRescheduleBooking(bookingId: string, oldZoomMeetingId?: string) {
    if (oldZoomMeetingId) {
        const { deleteZoomMeeting } = await import('@/lib/integrations/zoom');
        try {
            await deleteZoomMeeting(oldZoomMeetingId);
            console.log(`Deleted old Zoom meeting ${oldZoomMeetingId}`);
        } catch (error) {
            console.error(`Failed to delete old Zoom meeting ${oldZoomMeetingId}`, error);
        }
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { candidate: true, professional: true },
    });

    if (!booking) throw new Error('Booking not found');
    if (!booking.startAt || !booking.endAt) throw new Error('Booking missing time');

    try {
        const durationMinutes = (booking.endAt.getTime() - booking.startAt.getTime()) / (1000 * 60);
        const meeting = await createZoomMeeting({
            topic: 'Rescheduled Consultation: Professional & Candidate',
            start_time: booking.startAt,
            duration: durationMinutes,
            timezone: 'UTC',
            candidateEmail: booking.candidate.email,
            professionalEmail: booking.professional.email,
            candidateName: booking.candidate.email,
            professionalName: booking.professional.email,
        });

        await completeIntegrations(bookingId, {
            joinUrl: meeting.join_url,
            meetingId: meeting.id.toString(),
            candidateJoinUrl: meeting.candidate_join_url,
            professionalJoinUrl: meeting.professional_join_url,
            candidateRegistrantId: meeting.candidate_registrant_id,
            professionalRegistrantId: meeting.professional_registrant_id,
        });
    } catch (error) {
        console.error(`Failed to create new Zoom meeting for reschedule ${bookingId}`, error);
        throw error;
    }

    return { processed: true, type: 'reschedule' };
}
