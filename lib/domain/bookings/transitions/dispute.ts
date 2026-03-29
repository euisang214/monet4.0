import { AttendanceOutcome, BookingStatus, DisputeReason, DisputeStatus, PaymentStatus, Role } from '@prisma/client';
import { StateInvariantError, TransitionConflictError, TransitionError } from '../errors';
import { defaultPrisma, transitionBooking, type Dependencies } from './shared';

export async function initiateDispute(
    bookingId: string,
    actor: { userId: string; role: Role },
    reason: string,
    description: string,
    deps: Dependencies = { prisma: defaultPrisma },
    options?: { attendanceOutcome?: AttendanceOutcome }
) {
    return transitionBooking(
        bookingId,
        BookingStatus.dispute_pending,
        { actor, reason, metadata: { attendanceOutcome: options?.attendanceOutcome } },
        deps,
        async (tx) => {
            const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

            const isParticipant = booking.candidateId === actor.userId || booking.professionalId === actor.userId;
            if (!isParticipant && actor.role !== Role.ADMIN) {
                throw new TransitionError('Not authorized');
            }

            if (booking.status === BookingStatus.dispute_pending) {
                const existingDispute = await tx.dispute.findUnique({ where: { bookingId } });
                if (!existingDispute) {
                    throw new StateInvariantError('Booking is dispute_pending but no Dispute record exists');
                }

                if (
                    existingDispute.initiatorId !== actor.userId
                    || existingDispute.reason !== reason
                    || existingDispute.description !== description
                ) {
                    throw new TransitionConflictError('Dispute already exists with different details');
                }

                if (options?.attendanceOutcome && booking.attendanceOutcome && booking.attendanceOutcome !== options.attendanceOutcome) {
                    throw new TransitionConflictError('Dispute already exists with a different attendance outcome');
                }

                if (options?.attendanceOutcome && booking.attendanceOutcome !== options.attendanceOutcome) {
                    return tx.booking.update({
                        where: { id: bookingId },
                        data: { attendanceOutcome: options.attendanceOutcome },
                    });
                }

                return booking;
            }

            const validOrigins: BookingStatus[] = [BookingStatus.accepted, BookingStatus.completed];
            if (!validOrigins.includes(booking.status)) {
                throw new TransitionError(`Cannot initiate dispute from ${booking.status}`);
            }

            await tx.dispute.create({
                data: {
                    bookingId,
                    initiatorId: actor.userId,
                    reason: reason as DisputeReason,
                    description,
                    status: DisputeStatus.open
                }
            });

            return tx.booking.update({
                where: { id: bookingId },
                data: {
                    status: BookingStatus.dispute_pending,
                    attendanceOutcome: options?.attendanceOutcome,
                }
            });
        }
    );
}

export async function resolveDispute(
    bookingId: string,
    resolution: 'refund' | 'partial_refund' | 'dismiss',
    actor: { userId: string; role: Role },
    options?: { refundAmountCents?: number; resolutionNotes?: string },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.ADMIN) throw new TransitionError('Only admin can resolve disputes');

    let targetStatus: BookingStatus;
    if (resolution === 'dismiss') {
        targetStatus = BookingStatus.completed;
    } else if (resolution === 'refund') {
        targetStatus = BookingStatus.refunded;
    } else {
        targetStatus = BookingStatus.completed;
    }

    return transitionBooking(
        bookingId,
        targetStatus,
        { actor, reason: options?.resolutionNotes, skipInvariantCheck: true },
        deps,
        async (tx) => {
            const booking = await tx.booking.findUniqueOrThrow({
                where: { id: bookingId },
                include: { payment: true }
            });

            if (booking.status !== BookingStatus.dispute_pending) {
                if (booking.status === targetStatus) {
                    if (resolution === 'dismiss') {
                        if (booking.payment?.status === PaymentStatus.released) {
                            return booking;
                        }
                        throw new TransitionConflictError('Dispute is already resolved with a different payout outcome');
                    }

                    if (resolution === 'refund') {
                        if (booking.payment?.status === PaymentStatus.refunded) {
                            return booking;
                        }
                        throw new TransitionConflictError('Dispute is already resolved with a different refund outcome');
                    }

                    const refundAmount = options?.refundAmountCents;
                    if (!refundAmount || refundAmount <= 0) {
                        throw new TransitionError('Partial refund requires valid refundAmountCents');
                    }

                    if (
                        booking.payment
                        && (booking.payment.status === PaymentStatus.partially_refunded || booking.payment.status === PaymentStatus.refunded)
                        && booking.payment.refundedAmountCents === refundAmount
                    ) {
                        return booking;
                    }

                    throw new TransitionConflictError('Dispute is already resolved with a different refund amount');
                }

                throw new TransitionError('Booking not in dispute');
            }

            if (resolution === 'refund') {
                await tx.payment.update({
                    where: { bookingId },
                    data: { status: PaymentStatus.refunded, refundedAmountCents: booking.priceCents || 0 }
                });
                return tx.booking.update({
                    where: { id: bookingId },
                    data: { status: BookingStatus.refunded }
                });
            }

            if (resolution === 'partial_refund') {
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
            }

            return tx.booking.update({
                where: { id: bookingId },
                data: { status: BookingStatus.completed }
            });
        }
    );
}
