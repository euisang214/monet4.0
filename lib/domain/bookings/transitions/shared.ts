import { BookingStatus, PaymentStatus, Prisma, PrismaClient, PayoutStatus, QCStatus, Role } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db';
import { stripe } from '@/lib/integrations/stripe';
import { notificationsQueue } from '@/lib/queues';
import { createAuditLog } from '@/lib/shared/audit';
import { StateInvariantError, TransitionError } from '../errors';

export type TransitionActor = {
    userId: string;
    role: Role;
} | 'system';

type TransitionContext = {
    actor: TransitionActor;
    reason?: string;
    metadata?: Record<string, unknown>;
    skipInvariantCheck?: boolean;
};

export type Dependencies = {
    prisma: PrismaClient | Prisma.TransactionClient;
};

export type StripeDependencies = {
    stripe?: Pick<typeof stripe, 'refunds' | 'paymentIntents'>;
};

export { defaultPrisma };

type CalendarInviteRecipientRole = 'CANDIDATE' | 'PROFESSIONAL';

const CALENDAR_INVITE_RECIPIENT_ROLES: CalendarInviteRecipientRole[] = ['CANDIDATE', 'PROFESSIONAL'];

export function sameInstant(left: Date | null | undefined, right: Date | null | undefined) {
    if (!left || !right) return false;
    return left.getTime() === right.getTime();
}

export async function enqueueCalendarInviteRequestJobs(bookingId: string, meetingId: string) {
    await Promise.all(CALENDAR_INVITE_RECIPIENT_ROLES.map((recipientRole) => (
        notificationsQueue.add('notifications', {
            type: 'calendar_invite_request',
            bookingId,
            recipientRole,
            revisionKey: meetingId,
        }, {
            jobId: `cal-req-${bookingId}-${recipientRole}-${meetingId}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: true,
            removeOnFail: false,
        })
    )));
}

export async function enqueueCalendarInviteCancelJobs(bookingId: string) {
    await Promise.all(CALENDAR_INVITE_RECIPIENT_ROLES.map((recipientRole) => (
        notificationsQueue.add('notifications', {
            type: 'calendar_invite_cancel',
            bookingId,
            recipientRole,
        }, {
            jobId: `cal-cxl-${bookingId}-${recipientRole}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: true,
            removeOnFail: false,
        })
    )));
}

function validateInvariants(booking: {
    status: BookingStatus;
    payment?: { status: PaymentStatus } | null;
    payout?: { status: PayoutStatus } | null;
    feedback?: { qcStatus: QCStatus } | null;
    startAt?: Date | null;
    endAt?: Date | null;
    candidateLateCancellation?: boolean;
}) {
    const { status, payment, payout, feedback, startAt, endAt, candidateLateCancellation } = booking;
    const paymentStatus = payment?.status;
    const payoutStatus = payout?.status;
    const qcStatus = feedback?.qcStatus;

    if (paymentStatus === PaymentStatus.refunded) {
        const validStatuses: BookingStatus[] = [
            BookingStatus.cancelled,
            BookingStatus.refunded,
            BookingStatus.declined,
            BookingStatus.expired,
        ];
        if (!validStatuses.includes(status)) {
            throw new StateInvariantError(`Invariant violated: Payment is refunded but BookingStatus is ${status}`);
        }
    }

    if (paymentStatus === PaymentStatus.released) {
        const isPassed = qcStatus === QCStatus.passed;
        const isLateCancel = candidateLateCancellation === true;
        if (!isPassed && !isLateCancel) {
            throw new StateInvariantError('Invariant violated: Payment released but QC not passed AND not late cancellation');
        }
    }

    if (payoutStatus === PayoutStatus.blocked) {
        const validPaymentStatuses: PaymentStatus[] = [PaymentStatus.held, PaymentStatus.refunded];
        if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
            throw new StateInvariantError(`Invariant violated: Payout blocked but PaymentStatus is ${paymentStatus}`);
        }
    }

    if (payoutStatus === PayoutStatus.paid && paymentStatus !== PaymentStatus.released) {
        throw new StateInvariantError(`Invariant violated: Payout paid but PaymentStatus is ${paymentStatus}`);
    }

    if (status === BookingStatus.accepted && (!startAt || !endAt)) {
        throw new StateInvariantError('Invariant violated: Booking accepted but startAt/endAt missing');
    }

    if (status === BookingStatus.completed && qcStatus !== QCStatus.passed) {
        throw new StateInvariantError(`Invariant violated: Booking completed but QCStatus is ${qcStatus}`);
    }

    if (paymentStatus === PaymentStatus.authorized) {
        const validStatuses: BookingStatus[] = [
            BookingStatus.requested,
            BookingStatus.declined,
            BookingStatus.expired,
        ];
        if (!validStatuses.includes(status)) {
            throw new StateInvariantError(`Invariant violated: Payment authorized but BookingStatus is ${status}`);
        }
    }
}

export async function transitionBooking<T>(
    bookingId: string,
    targetStatus: BookingStatus,
    context: TransitionContext,
    deps: Dependencies,
    updateFn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
    const runInTransaction = async (tx: Prisma.TransactionClient) => {
        const booking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: true,
                payout: true,
                feedback: true,
            },
        });

        if (!booking) {
            throw new TransitionError(`Booking ${bookingId} not found`);
        }

        const result = await updateFn(tx);

        if (booking.status === targetStatus) {
            return result;
        }

        const actorUserId = context.actor === 'system' ? null : context.actor.userId;
        await createAuditLog(
            tx,
            'Booking',
            bookingId,
            `transition:${booking.status}->${targetStatus}`,
            actorUserId,
            {
                previousStatus: booking.status,
                newStatus: targetStatus,
                reason: context.reason,
                ...(context.metadata || {}),
            }
        );

        const updatedBooking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: true,
                payout: true,
                feedback: true,
            },
        });

        if (!updatedBooking) {
            throw new Error('Booking disappeared after update');
        }

        if (!context.skipInvariantCheck) {
            validateInvariants(updatedBooking);
        }

        return result;
    };

    if ('$transaction' in deps.prisma) {
        return (deps.prisma as PrismaClient).$transaction(runInTransaction);
    }

    return runInTransaction(deps.prisma as Prisma.TransactionClient);
}
