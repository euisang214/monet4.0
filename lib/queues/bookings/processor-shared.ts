import { AttendanceOutcome, Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db';
import { createAuditLog } from '@/lib/shared/audit';
import { cancelBooking, completeCall, initiateDispute } from '@/lib/domain/bookings/transitions';
import { normalizeEmail } from '@/lib/integrations/zoom-attendance';

export type AttendanceRecommendation =
    | 'both_joined'
    | 'candidate_no_show'
    | 'professional_no_show'
    | 'both_no_show'
    | 'ambiguous';

export type MappedRole = 'candidate' | 'professional' | 'unknown';
export type MappingMethod = 'registrant_id' | 'strict_email' | 'unknown';

export async function recordBookingAudit(
    bookingId: string,
    action: string,
    metadata: Record<string, unknown>,
) {
    await prisma.$transaction(async (tx) => {
        await createAuditLog(tx, 'Booking', bookingId, action, null, metadata as Prisma.InputJsonValue);
    });
}

export function getAttendanceMinutesFromStart(startAt: Date, now: Date) {
    return Math.floor((now.getTime() - startAt.getTime()) / (60 * 1000));
}

export function determineParticipantMapping({
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

export async function applyFinalNoShowDecision({
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
            { attendanceOutcome: AttendanceOutcome.both_no_show },
        );
        return 'ambiguous' as AttendanceRecommendation;
    }

    if (!candidateJoined && professionalJoined) {
        await cancelBooking(
            booking.id,
            'system',
            'Automated: Candidate No-Show',
            { attendanceOutcome: AttendanceOutcome.candidate_no_show },
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
            { attendanceOutcome: AttendanceOutcome.professional_no_show },
        );
        return 'professional_no_show' as AttendanceRecommendation;
    }

    await initiateDispute(
        booking.id,
        { userId: booking.candidateId, role: 'CANDIDATE' },
        'no_show',
        'Automated no-show decision (automated=true,outcome=both_no_show): Both parties failed to join.',
        undefined,
        { attendanceOutcome: AttendanceOutcome.both_no_show },
    );
    return 'both_no_show' as AttendanceRecommendation;
}
