import { AttendanceOutcome, BookingStatus } from '@prisma/client';
import { prisma } from '@/lib/core/db';
import { completeCall } from '@/lib/domain/bookings/transitions';
import {
    ZOOM_ATTENDANCE_ENFORCEMENT,
    ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES,
    ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES,
} from '@/lib/integrations/zoom-attendance';
import {
    applyFinalNoShowDecision,
    getAttendanceMinutesFromStart,
    recordBookingAudit,
    type AttendanceRecommendation,
} from '@/lib/queues/bookings/processor-shared';

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
            const candidateJoined = !!booking.candidateJoinedAt;
            const professionalJoined = !!booking.professionalJoinedAt;
            const isFinalCheck = minutesFromStart >= ZOOM_ATTENDANCE_FINAL_CHECK_MINUTES;

            if (candidateJoined && professionalJoined) {
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
                    professionalJoined,
                });
                continue;
            }

            const unknownEvidenceWindowStart = new Date(
                booking.startAt.getTime() - ZOOM_ATTENDANCE_INITIAL_CHECK_MINUTES * 60 * 1000,
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
                if (!candidateJoined && professionalJoined) return 'candidate_no_show';
                if (candidateJoined && !professionalJoined) return 'professional_no_show';
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
                    professionalJoined,
                    hasUnknownJoinEvidence,
                });
                continue;
            }

            const applied = await applyFinalNoShowDecision({
                booking: { id: booking.id, candidateId: booking.candidateId },
                candidateJoined,
                professionalJoined,
                hasUnknownJoinEvidence,
            });

            await recordBookingAudit(booking.id, 'attendance:no_show_decision', {
                phase: 'final',
                recommendation,
                applied,
                enforcementEnabled: true,
                minutesFromStart,
                candidateJoined,
                professionalJoined,
                hasUnknownJoinEvidence,
            });
        } catch (error) {
            console.error(`[BOOKINGS] Failed to process no-show for booking ${booking.id}`, error);
            failedBookingIds.push(booking.id);
        }
    }

    return { processed: true, count: staleBookings.length, failedBookingIds };
}
