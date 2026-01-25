import { Prisma, AuditLog } from '@prisma/client';

/**
 * Centralized Audit Logging
 * 
 * Creates audit log entries for state transitions and admin actions.
 * All state machine transitions should log here.
 * 
 * @see CLAUDE.md lines 801-819
 */

export type AuditEntity = 'Booking' | 'Payment' | 'Payout' | 'Feedback' | 'Dispute';

export async function createAuditLog(
    tx: Prisma.TransactionClient,
    entity: AuditEntity,
    entityId: string,
    action: string,
    actorUserId: string | null,
    metadata?: Prisma.InputJsonValue
): Promise<AuditLog> {
    return tx.auditLog.create({
        data: {
            entity,
            entityId,
            action,
            actorUserId,
            metadata: metadata ?? Prisma.JsonNull,
        },
    });
}

/**
 * Common audit actions
 */
export const AuditActions = {
    // Booking transitions
    BOOKING_REQUESTED: 'booking_requested',
    BOOKING_ACCEPTED: 'booking_accepted',
    BOOKING_DECLINED: 'booking_declined',
    BOOKING_CANCELLED: 'booking_cancelled',
    BOOKING_EXPIRED: 'booking_expired',
    BOOKING_COMPLETED: 'booking_completed',
    BOOKING_RESCHEDULE_REQUESTED: 'booking_reschedule_requested',
    BOOKING_RESCHEDULE_CONFIRMED: 'booking_reschedule_confirmed',
    BOOKING_RESCHEDULE_REJECTED: 'booking_reschedule_rejected',

    // Payment actions
    PAYMENT_CAPTURED: 'payment_captured',
    PAYMENT_REFUNDED: 'payment_refunded',
    PAYMENT_PARTIAL_REFUND: 'payment_partial_refund',

    // Payout actions
    PAYOUT_RELEASED: 'payout_released',
    PAYOUT_BLOCKED: 'payout_blocked',

    // QC actions
    QC_PASSED: 'qc_passed',
    QC_REVISE: 'qc_revise',

    // Dispute actions
    DISPUTE_OPENED: 'dispute_opened',
    DISPUTE_RESOLVED: 'dispute_resolved',
} as const;
