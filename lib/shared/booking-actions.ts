import { BookingStatus } from '@prisma/client';

/**
 * Centralized booking action visibility logic.
 * Used by both client components and can be used by API responses to ensure consistency.
 */
export function getBookingActionVisibility(
    status: BookingStatus,
    hasZoomUrl: boolean
) {
    return {
        showJoin: status === BookingStatus.accepted && hasZoomUrl,
        showReschedule: status === BookingStatus.accepted,
        showCancel: ([BookingStatus.requested, BookingStatus.accepted] as BookingStatus[]).includes(status),
        showDispute: ([BookingStatus.accepted, BookingStatus.completed] as BookingStatus[]).includes(status),
        showReview: status === BookingStatus.completed,
    };
}

/**
 * Type for the visibility result
 */
export type BookingActionVisibility = ReturnType<typeof getBookingActionVisibility>;
