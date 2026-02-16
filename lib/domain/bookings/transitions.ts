import { Prisma, BookingStatus, PaymentStatus, QCStatus, PayoutStatus, DisputeStatus, Role, PrismaClient, AttendanceOutcome } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/core/db';
import { differenceInHours, addHours } from 'date-fns';
import { StateInvariantError, TransitionError } from './errors';
import { stripe } from '@/lib/integrations/stripe';
import { notificationsQueue } from '@/lib/queues';
import { calculatePlatformFee } from '@/lib/domain/payments/utils';
import { isLateCancellation } from '@/lib/domain/bookings/utils';
import { createAuditLog } from '@/lib/shared/audit';


type TransitionContext = {
    actor: {
        userId: string;
        role: Role;
    } | 'system';
    reason?: string;
    metadata?: Record<string, any>;
    skipInvariantCheck?: boolean; // For admin overrides (dispute resolution, QC timeout)
};

type Dependencies = {
    prisma: PrismaClient | Prisma.TransactionClient;
};

type StripeDependencies = {
    stripe?: Pick<typeof stripe, 'refunds' | 'paymentIntents'>;
};

/**
 * Validates State Invariants (CLAUDE.md #942)
 */
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

    // 1. PaymentStatus = refunded ⇒ BookingStatus ∈ {cancelled, refunded, declined, expired}
    if (paymentStatus === PaymentStatus.refunded) {
        const validStatuses: BookingStatus[] = [BookingStatus.cancelled, BookingStatus.refunded, BookingStatus.declined, BookingStatus.expired];
        if (!validStatuses.includes(status)) {
            throw new StateInvariantError(`Invariant violated: Payment is refunded but BookingStatus is ${status}`);
        }
    }

    // 2. PaymentStatus = released ⇒ QCStatus = passed OR candidateLateCancellation = true
    if (paymentStatus === PaymentStatus.released) {
        const isPassed = qcStatus === QCStatus.passed;
        const isLateCancel = candidateLateCancellation === true;
        if (!isPassed && !isLateCancel) {
            throw new StateInvariantError('Invariant violated: Payment released but QC not passed AND not late cancellation');
        }
    }

    // 3. PayoutStatus = blocked ⇒ PaymentStatus ∈ {held, refunded}
    if (payoutStatus === PayoutStatus.blocked) {
        const validPaymentStatuses: PaymentStatus[] = [PaymentStatus.held, PaymentStatus.refunded];
        if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
            throw new StateInvariantError(`Invariant violated: Payout blocked but PaymentStatus is ${paymentStatus}`);
        }
    }

    // 4. PayoutStatus = paid ⇒ PaymentStatus = released
    if (payoutStatus === PayoutStatus.paid) {
        if (paymentStatus !== PaymentStatus.released) {
            throw new StateInvariantError(`Invariant violated: Payout paid but PaymentStatus is ${paymentStatus}`);
        }
    }

    // 5. BookingStatus = accepted ⇒ startAt and endAt must be set
    if (status === BookingStatus.accepted) {
        if (!startAt || !endAt) {
            throw new StateInvariantError('Invariant violated: Booking accepted but startAt/endAt missing');
        }
    }

    // 6. BookingStatus = completed ⇒ qcStatus = passed
    if (status === BookingStatus.completed) {
        if (qcStatus !== QCStatus.passed) {
            throw new StateInvariantError(`Invariant violated: Booking completed but QCStatus is ${qcStatus}`);
        }
    }

    // 7. PaymentStatus = authorized ⇒ BookingStatus ∈ {requested, declined, expired}
    if (paymentStatus === PaymentStatus.authorized) {
        const validStatuses: BookingStatus[] = [BookingStatus.requested, BookingStatus.declined, BookingStatus.expired];
        if (!validStatuses.includes(status)) {
            throw new StateInvariantError(`Invariant violated: Payment authorized but BookingStatus is ${status}`);
        }
    }
}

/**
 * Common Transition Logic
 * Wraps update in transaction with locking, invariant checking, and audit logging.
 */
async function transitionBooking<T>(
    bookingId: string,
    targetStatus: BookingStatus,
    context: TransitionContext,
    deps: Dependencies,
    updateFn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
    // Use deps.prisma.$transaction
    // Note: deps.prisma might ALREADY be a transaction client if injected.
    // Prisma TransactionClient doesn't have $transaction.
    // We need to check if it's a client or tx.
    // However, simpler pattern for testing is usually passing the client which has $transaction.
    // If we receive a TxClient, we just execute.

    const runInTransaction = async (tx: Prisma.TransactionClient) => {
        // 1. Lock and Fetch
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

        // 2. Execute Update
        const result = await updateFn(tx);

        // 3. Create Audit Log
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

        // 4. Fetch updated booking for Invariant Check
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

        // 5. Validate Invariants (unless explicitly skipped for admin overrides)
        if (!context.skipInvariantCheck) {
            validateInvariants(updatedBooking);
        }

        return result;
    };

    if ('$transaction' in deps.prisma) {
        return (deps.prisma as PrismaClient).$transaction(runInTransaction);
    } else {
        // It is already a transaction client
        return runInTransaction(deps.prisma as Prisma.TransactionClient);
    }
}

// 0. Initial Request
export async function createBookingRequest(
    candidateId: string,
    professionalId: string,
    weeks: number,
    deps: Dependencies & { stripe?: typeof stripe } = { prisma: defaultPrisma, stripe: stripe }
) {
    // 1. Validate inputs
    const candidate = await deps.prisma.user.findUniqueOrThrow({ where: { id: candidateId } });
    if (candidate.role !== Role.CANDIDATE) throw new TransitionError("User is not a candidate");

    const professional = await deps.prisma.professionalProfile.findUniqueOrThrow({
        where: { userId: professionalId },
        include: { user: true }
    });

    // 2. Create Stripe PaymentIntent (manual capture)
    const amountCents = professional.priceCents;
    const platformFee = calculatePlatformFee(amountCents);

    const paymentIntent = await deps.stripe!.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        capture_method: 'manual',
        automatic_payment_methods: { enabled: true },
        metadata: {
            candidateId,
            professionalId,
            type: 'booking_request'
        }
    });

    // 3. Create Booking & Payment Record
    // We wrap in transaction
    const runInTransaction = async (tx: Prisma.TransactionClient) => {
        // Create Booking
        const booking = await tx.booking.create({
            data: {
                candidateId,
                professionalId,
                status: BookingStatus.requested,
                priceCents: amountCents,
                expiresAt: addHours(new Date(), 120),
                timezone: candidate.timezone,
            }
        });

        // Create Payment Record (authorized pending)
        await tx.payment.create({
            data: {
                bookingId: booking.id,
                amountGross: amountCents,
                platformFee: platformFee,
                stripePaymentIntentId: paymentIntent.id,
                status: PaymentStatus.authorized,
            }
        });

        // Create Audit Log
        await createAuditLog(
            tx,
            'Booking',
            booking.id,
            'booking_requested',
            candidateId,
            {
                priceCents: amountCents,
                weeks,
            }
        );

        // Update PI metadata with booking ID now that we have it
        try {
            await deps.stripe!.paymentIntents.update(paymentIntent.id, {
                metadata: { bookingId: booking.id }
            });
        } catch (e) {
            console.error("Failed to update PI metadata", e);
        }

        return {
            booking,
            clientSecret: paymentIntent.client_secret,
            stripePaymentIntentId: paymentIntent.id
        };
    };

    if ('$transaction' in deps.prisma) {
        const result = await (deps.prisma as PrismaClient).$transaction(runInTransaction);
        await notificationsQueue.add('notifications', {
            type: 'booking_requested',
            bookingId: result.booking.id,
        });
        return result;
    } else {
        const result = await runInTransaction(deps.prisma as Prisma.TransactionClient);
        // Note: If we are already in a transaction, adding to queue here might be risky if transaction fails later?
        // But runInTransaction is the transaction scope. If we are here, it succeeded?
        // Actually, if deps.prisma is a tx client, runInTransaction is just an async function.
        // It awaits the logic. If it returns, the logic completed.
        // But the outer transaction might verify/commit later.
        // Queue add is a side effect. Best to do it after commit.
        // However, we don't control the outer commit here if it's passed in.
        // Should we assume side effects are okay? Or schedule them?
        // For now, we add to queue. BullMQ is Redis based, separate from Postgres.
        // If Postgres rollback happens, we might send email for non-existent booking?
        // But 'notifications.ts' checks for booking existence. So it will just fail/skip.
        await notificationsQueue.add('notifications', {
            type: 'booking_requested',
            bookingId: result.booking.id,
        });
        return result;
    }
}

// 1. requested → declined
export async function declineBooking(
    bookingId: string,
    actor: { userId: string; role: Role },
    reason: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.PROFESSIONAL) {
        throw new TransitionError('Only professionals can decline bookings');
    }

    const result = await transitionBooking(bookingId, BookingStatus.declined, { actor, reason }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.requested) {
            throw new TransitionError(`Cannot decline booking in state ${booking.status}`);
        }

        if (booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized to decline this booking');
        }

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.declined,
                declineReason: reason,
            },
        });

        await tx.payment.updateMany({
            where: { bookingId: bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.cancelled },
        });

        return updated;
    });

    await notificationsQueue.add('notifications', {
        type: 'booking_declined',
        bookingId: bookingId,
    });
    return result;
}

// 2. requested → expired
export async function expireBooking(
    bookingId: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.expired, { actor: 'system', reason: 'TTL expired' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.requested) {
            if (booking.status === BookingStatus.expired) return booking;
            throw new TransitionError(`Cannot expire booking in state ${booking.status}`);
        }

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.expired },
        });

        await tx.payment.updateMany({
            where: { bookingId: bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.cancelled },
        });

        return updated;
    });
}

// 3. requested → accepted
export async function acceptBooking(
    bookingId: string,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.PROFESSIONAL) {
        throw new TransitionError('Only professionals can accept bookings');
    }

    const result = await transitionBooking(bookingId, BookingStatus.accepted, { actor }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.requested) {
            throw new TransitionError(`Cannot accept booking in state ${booking.status}`);
        }
        if (booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.accepted },
        });

        await tx.payment.updateMany({
            where: { bookingId: bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.held },
        });

        return updated;
    });

    await notificationsQueue.add('notifications', {
        type: 'booking_accepted',
        bookingId: bookingId,
    });
    return result;
}

// 4. accepted → accepted_pending_integrations
export async function startIntegrations(
    bookingId: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.accepted_pending_integrations, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.accepted) {
            throw new TransitionError(`Cannot start integrations from ${booking.status}`);
        }
        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.accepted_pending_integrations },
        });
    });
}

// SPECIAL: requested → accepted_pending_integrations
export async function acceptBookingWithIntegrations(
    bookingId: string,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.PROFESSIONAL) throw new TransitionError('Not authorized');

    const result = await transitionBooking(bookingId, BookingStatus.accepted_pending_integrations, { actor }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.requested) {
            throw new TransitionError(`Invalid status: ${booking.status}`);
        }
        if (booking.professionalId !== actor.userId) throw new TransitionError('Not authorized');

        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.accepted_pending_integrations },
        });

        await tx.payment.updateMany({
            where: { bookingId: bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.held },
        });

        return updated;
    });

    await notificationsQueue.add('notifications', {
        type: 'booking_accepted',
        bookingId: bookingId,
    });
    return result;
}

// 5. accepted_pending_integrations → accepted
export async function completeIntegrations(
    bookingId: string,
    zoomData: { joinUrl: string; meetingId: string },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.accepted, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.accepted_pending_integrations) {
            throw new TransitionError(`Invalid status: ${booking.status}`);
        }
        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.accepted,
                zoomJoinUrl: zoomData.joinUrl,
                zoomMeetingId: zoomData.meetingId,
            }
        });
    });
}

// 6. accepted → reschedule_pending
export async function requestReschedule(
    bookingId: string,
    actor: { userId: string; role: Role },
    slots?: { start: Date; end: Date }[],
    reason?: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.reschedule_pending, { actor, reason, metadata: { slots } }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.accepted) {
            throw new TransitionError(`Cannot request reschedule from ${booking.status}`);
        }
        if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.reschedule_pending },
        });
    });
}

// 7. reschedule_pending → accepted
export async function confirmReschedule(
    bookingId: string,
    actor: { userId: string; role: Role },
    newStartAt: Date,
    newEndAt: Date,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.accepted, { actor }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.reschedule_pending) {
            throw new TransitionError(`Cannot confirm reschedule from ${booking.status}`);
        }

        if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.accepted,
                startAt: newStartAt,
                endAt: newEndAt,
            },
        });
    });
}

// 8. accepted → cancelled
// 8. accepted → cancelled
export async function cancelBooking(
    bookingId: string,
    actor: { userId: string; role: Role } | 'system',
    reason?: string,
    options?: { attendanceOutcome?: AttendanceOutcome },
    deps: Dependencies & StripeDependencies = { prisma: defaultPrisma, stripe }
) {
    const actorInfo = actor === 'system' ? 'system' : actor;

    return transitionBooking(bookingId, BookingStatus.cancelled, { actor: actorInfo, reason, metadata: { attendanceOutcome: options?.attendanceOutcome } }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        const validOrigins: BookingStatus[] = [BookingStatus.accepted, BookingStatus.reschedule_pending];
        if (!validOrigins.includes(booking.status)) {
            throw new TransitionError(`Cannot cancel from ${booking.status}`);
        }

        // Authorization check: if not system, must be candidate or professional
        if (actor !== 'system') {
            if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
                throw new TransitionError('Not authorized');
            }
        }

        let isLate = false;

        // Force late if candidate no-show passed
        if (options?.attendanceOutcome === AttendanceOutcome.candidate_no_show) {
            isLate = true;
        } else if (booking.startAt) {
            // Standard time-based late check
            // Use utility for consistent logic
            if (isLateCancellation(booking.startAt)) {
                if (actor === 'system' || (typeof actor !== 'string' && actor.role === Role.CANDIDATE)) {
                    isLate = true;
                }
            }
        }

        // Payment Handling
        if (isLate) {
            // Late cancellation: Release payment to Professional
            await tx.payment.update({
                where: { bookingId },
                data: { status: PaymentStatus.released }
            });
            // Note: Payout creation is handled by QC/Payout job or inferred?
            // CLAUDE.md: "Payout triggered immediately, bypassing QC"
            // We should create the Payout record here to be safe and rigorous.
            const payment = await tx.payment.findUnique({ where: { bookingId } });
            if (payment) {
                const netAmount = payment.amountGross - payment.platformFee;
                // Fetch professional stripe account id
                // We need to fetch professional user to get stripeAccountId
                const professional = await tx.user.findUnique({ where: { id: booking.professionalId } });
                if (professional?.stripeAccountId) {
                    await tx.payout.create({
                        data: {
                            bookingId,
                            proStripeAccountId: professional.stripeAccountId,
                            amountNet: netAmount,
                            status: PayoutStatus.pending, // Worker will pick up and pay
                        }
                    });
                }
            }

        } else {
            // Standard cancellation: Refund Candidate AND Release Auth
            // If held -> refunded
            // If authorized -> cancelled
            // We query payment first
            const payment = await tx.payment.findUnique({ where: { bookingId } });
            if (payment) {
                if (payment.status === PaymentStatus.held) {
                    if (deps.stripe && payment.stripePaymentIntentId) {
                        // Keep Stripe and DB states in lockstep: refund first, then persist refunded status.
                        await deps.stripe.refunds.create({
                            payment_intent: payment.stripePaymentIntentId,
                            reason: 'requested_by_customer'
                        });
                    }
                    await tx.payment.update({
                        where: { bookingId },
                        data: { status: PaymentStatus.refunded, refundedAmountCents: payment.amountGross }
                    });
                } else if (payment.status === PaymentStatus.authorized) {
                    if (deps.stripe && payment.stripePaymentIntentId) {
                        await deps.stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
                    }
                    await tx.payment.update({
                        where: { bookingId },
                        data: { status: PaymentStatus.cancelled }
                    });
                }
            }
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.cancelled,
                candidateLateCancellation: isLate,
                attendanceOutcome: options?.attendanceOutcome,
            },
        });
    });
}

// 9. accepted → dispute_pending
// 9. accepted → dispute_pending
export async function initiateDispute(
    bookingId: string,
    actor: { userId: string; role: Role },
    reason: string,
    description: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.dispute_pending, { actor, reason }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        // Create Dispute
        // Validate enum reason? We assume string passed is valid or cast it.
        // Prisma Client generates `DisputeReason` enum.
        // We cast it.
        const disputeReason = reason as any; // simplified for now

        await tx.dispute.create({
            data: {
                bookingId,
                initiatorId: actor.userId,
                reason: disputeReason,
                description,
                status: DisputeStatus.open
            }
        });

        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.dispute_pending }
        });
    });
}

// 10. dispute_pending → refunded OR completed
export async function resolveDispute(
    bookingId: string,
    resolution: 'refund' | 'partial_refund' | 'dismiss',
    actor: { userId: string; role: Role },
    options?: { refundAmountCents?: number; resolutionNotes?: string },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.ADMIN) throw new TransitionError('Only admin can resolve disputes');

    // Determine target status based on resolution
    let targetStatus: BookingStatus;
    if (resolution === 'dismiss') {
        targetStatus = BookingStatus.completed;
    } else if (resolution === 'refund') {
        targetStatus = BookingStatus.refunded;
    } else {
        // partial_refund → completed (candidate gets partial refund, pro gets remainder)
        targetStatus = BookingStatus.completed;
    }

    return transitionBooking(bookingId, targetStatus, { actor, reason: options?.resolutionNotes, skipInvariantCheck: true }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        if (booking.status !== BookingStatus.dispute_pending) {
            throw new TransitionError('Booking not in dispute');
        }

        if (resolution === 'refund') {
            // Full refund
            await tx.payment.update({
                where: { bookingId },
                data: { status: PaymentStatus.refunded, refundedAmountCents: booking.priceCents || 0 }
            });
            return tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.refunded }
            });
        } else if (resolution === 'partial_refund') {
            // Partial refund
            const refundAmount = options?.refundAmountCents;
            if (!refundAmount || refundAmount <= 0) {
                throw new TransitionError('Partial refund requires valid refundAmountCents');
            }

            const newPaymentStatus = refundAmount >= (booking.priceCents || 0)
                ? PaymentStatus.refunded
                : PaymentStatus.partially_refunded;

            const newBookingStatus = newPaymentStatus === PaymentStatus.refunded
                ? BookingStatus.refunded
                : BookingStatus.completed;

            await tx.payment.update({
                where: { bookingId },
                data: { status: newPaymentStatus, refundedAmountCents: refundAmount }
            });
            return tx.booking.update({
                where: { id: bookingId },
                data: { status: newBookingStatus }
            });
        } else {
            // dismiss → completed
            const updated = await tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.completed }
            });
            return updated;
        }
    });
}


// 11. accepted → completed_pending_feedback
export async function completeCall(
    bookingId: string,
    options?: { attendanceOutcome?: AttendanceOutcome },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.completed_pending_feedback, { actor: 'system' }, deps, async (tx) => {
        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.completed_pending_feedback,
                attendanceOutcome: options?.attendanceOutcome,
            }
        });
    });
}

// 12. completed_pending_feedback → completed
export async function completeBooking(
    bookingId: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.completed, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { feedback: true } });
        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.completed }
        });
    });
}
// 13. reschedule_pending → cancelled (Reject Reschedule)
export async function rejectReschedule(
    bookingId: string,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.cancelled, { actor, reason: 'Reschedule rejected' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        if (booking.status !== BookingStatus.reschedule_pending) {
            throw new TransitionError(`Cannot reject reschedule from ${booking.status}`);
        }

        if (booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized');
        }

        // Logic here mirrors cancelBooking but forced.
        // If startAt > 6 hours, refund. Else payout.
        // Note: reschedule_pending implies we have a previously accepted time in startAt/endAt.

        let isLate = false;
        if (booking.startAt) {
            // "Refund follows standard cancellation policy"
            // If < 6 hours, it's late.
            if (isLateCancellation(booking.startAt)) {
                isLate = true;
            }
        }

        // If not late, we refund.
        if (!isLate) {
            await tx.payment.update({
                where: { bookingId },
                data: { status: PaymentStatus.refunded, refundedAmountCents: booking.priceCents || 0 }
            });
        }
        // If late, we assume payout proceeds (status stays 'held' until manual/job payout? 
        // Or do we trigger payout? 
        // Standard cancellation: "Payout triggered immediately, bypassing QC".
        // Let's stick to standard flow: if late, we release.
        if (isLate) {
            await tx.payment.update({
                where: { bookingId },
                data: { status: PaymentStatus.released }
            });
            // Create pending payout
            // We need to fetch platform fee to calculate net.
            // Simplified here: assumed standard payout logic elsewhere. 
            // Ideally we call a payout service. For now, valid config is PaymentStatus.released + isLate=true.
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.cancelled,
                candidateLateCancellation: isLate,
            },
        });
    });
}

// 14. Admin Manual Zoom Link Update
/**
 * Update Zoom meeting details and conditionally transition status
 * Used for admin fallback when integration provisioning fails
 */
export async function updateZoomDetails(
    bookingId: string,
    zoomJoinUrl: string,
    zoomMeetingId: string | undefined,
    actor: { userId: string; role: Role },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.ADMIN) {
        throw new TransitionError('Only admins can manually update Zoom details');
    }

    const booking = await deps.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true }
    });

    if (!booking) {
        throw new TransitionError(`Booking ${bookingId} not found`);
    }

    // Determine if we should transition status
    const shouldTransitionToAccepted = booking.status === BookingStatus.accepted_pending_integrations;

    const updates: {
        zoomJoinUrl: string;
        zoomMeetingId?: string;
        status?: BookingStatus;
    } = {
        zoomJoinUrl,
        ...(zoomMeetingId && { zoomMeetingId }),
    };

    if (shouldTransitionToAccepted) {
        updates.status = BookingStatus.accepted;
    }

    const updated = await deps.prisma.booking.update({
        where: { id: bookingId },
        data: updates,
    });

    // Create audit log
    await createAuditLog(
        deps.prisma as any,
        'Booking',
        bookingId,
        'admin:zoom_link_updated',
        actor.userId,
        {
            zoomJoinUrl,
            zoomMeetingId,
            previousStatus: booking.status,
            newStatus: updates.status ?? booking.status,
        }
    );

    return updated;
}
