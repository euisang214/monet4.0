import { BookingStatus, RescheduleAwaitingParty } from '@prisma/client';

/**
 * Centralized booking action visibility logic.
 * Used by both client components and can be used by API responses to ensure consistency.
 */
export function getBookingActionVisibility(
    status: BookingStatus,
    hasZoomUrl: boolean,
    rescheduleAwaitingParty?: RescheduleAwaitingParty | null
) {
    return {
        showJoin: status === BookingStatus.accepted && hasZoomUrl,
        showReschedule:
            status === BookingStatus.accepted
            || (status === BookingStatus.reschedule_pending && rescheduleAwaitingParty === RescheduleAwaitingParty.CANDIDATE),
        showCancel: ([BookingStatus.requested, BookingStatus.accepted] as BookingStatus[]).includes(status),
        showDispute: ([BookingStatus.accepted, BookingStatus.completed] as BookingStatus[]).includes(status),
        showReview: ([BookingStatus.completed, BookingStatus.completed_pending_feedback] as BookingStatus[]).includes(status),
    };
}

/**
 * Type for the visibility result
 */
export type BookingActionVisibility = ReturnType<typeof getBookingActionVisibility>;
