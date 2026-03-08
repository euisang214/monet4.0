import { AttendanceOutcome, BookingStatus, PaymentStatus, PayoutStatus, Role } from '@prisma/client';
import { stripe } from '@/lib/integrations/stripe';
import { TransitionConflictError, TransitionError } from '../errors';
import {
    defaultPrisma,
    enqueueCalendarInviteCancelJobs,
    transitionBooking,
    type Dependencies,
    type StripeDependencies,
} from './shared';
import { isLateCancellation } from '@/lib/domain/bookings/utils';

function shouldRefundCapturedPaymentIntent(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    return /can only cancel a PaymentIntent|already been captured|status of succeeded/i.test(error.message);
}

export async function cancelBooking(
    bookingId: string,
    actor: { userId: string; role: Role } | 'system',
    reason?: string,
    options?: { attendanceOutcome?: AttendanceOutcome },
    deps: Dependencies & StripeDependencies = { prisma: defaultPrisma, stripe }
) {
    const actorInfo = actor === 'system' ? 'system' : actor;
    let transitioned = false;

    const result = await transitionBooking(
        bookingId,
        BookingStatus.cancelled,
        { actor: actorInfo, reason, metadata: { attendanceOutcome: options?.attendanceOutcome } },
        deps,
        async (tx) => {
            const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

            if (actor !== 'system' && booking.candidateId !== actor.userId && booking.professionalId !== actor.userId) {
                throw new TransitionError('Not authorized');
            }

            if (booking.status === BookingStatus.cancelled) {
                const requestedOutcome = options?.attendanceOutcome;
                const existingOutcome = booking.attendanceOutcome ?? null;

                if (requestedOutcome && existingOutcome && existingOutcome !== requestedOutcome) {
                    throw new TransitionConflictError('Booking is already cancelled with a different attendance outcome');
                }

                if (requestedOutcome === AttendanceOutcome.candidate_no_show && !booking.candidateLateCancellation) {
                    throw new TransitionConflictError('Booking is already cancelled with a different payout/refund outcome');
                }

                return booking;
            }

            const validOrigins: BookingStatus[] = [BookingStatus.accepted, BookingStatus.reschedule_pending];
            if (!validOrigins.includes(booking.status)) {
                throw new TransitionError(`Cannot cancel from ${booking.status}`);
            }
            transitioned = true;

            let isLate = false;

            if (options?.attendanceOutcome === AttendanceOutcome.candidate_no_show) {
                isLate = true;
            } else if (booking.startAt && (actor === 'system' || actor.role === Role.CANDIDATE) && isLateCancellation(booking.startAt)) {
                isLate = true;
            }

            if (isLate) {
                await tx.payment.update({
                    where: { bookingId },
                    data: { status: PaymentStatus.released }
                });

                const payment = await tx.payment.findUnique({ where: { bookingId } });
                if (payment) {
                    const netAmount = payment.amountGross - payment.platformFee;
                    const professional = await tx.user.findUnique({ where: { id: booking.professionalId } });
                    if (professional?.stripeAccountId) {
                        await tx.payout.create({
                            data: {
                                bookingId,
                                proStripeAccountId: professional.stripeAccountId,
                                amountNet: netAmount,
                                status: PayoutStatus.pending,
                            }
                        });
                    }
                }
            } else {
                const payment = await tx.payment.findUnique({ where: { bookingId } });
                if (payment) {
                    if (payment.status === PaymentStatus.held) {
                        if (deps.stripe && payment.stripePaymentIntentId) {
                            try {
                                await deps.stripe.paymentIntents.cancel(payment.stripePaymentIntentId, {
                                    cancellation_reason: 'requested_by_customer'
                                });
                            } catch (stripeError: any) {
                                if (shouldRefundCapturedPaymentIntent(stripeError)) {
                                    await deps.stripe.refunds.create({
                                        payment_intent: payment.stripePaymentIntentId,
                                        reason: 'requested_by_customer'
                                    });
                                } else {
                                    throw stripeError;
                                }
                            }
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
        }
    );

    if (transitioned) {
        await enqueueCalendarInviteCancelJobs(bookingId);
    }

    return result;
}

export async function completeCall(
    bookingId: string,
    options?: { attendanceOutcome?: AttendanceOutcome },
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.completed_pending_feedback, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        if (booking.status === BookingStatus.completed_pending_feedback) {
            const requestedOutcome = options?.attendanceOutcome;
            const existingOutcome = booking.attendanceOutcome ?? null;

            if (requestedOutcome && existingOutcome && existingOutcome !== requestedOutcome) {
                throw new TransitionConflictError('Call is already completed with a different attendance outcome');
            }

            return booking;
        }

        if (booking.status !== BookingStatus.accepted) {
            throw new TransitionError(`Cannot complete call from ${booking.status}`);
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.completed_pending_feedback,
                attendanceOutcome: options?.attendanceOutcome,
            }
        });
    });
}

export async function completeBooking(
    bookingId: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    return transitionBooking(bookingId, BookingStatus.completed, { actor: 'system' }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { feedback: true } });

        if (booking.status === BookingStatus.completed) {
            return booking;
        }

        if (booking.status !== BookingStatus.completed_pending_feedback) {
            throw new TransitionError(`Cannot complete booking from ${booking.status}`);
        }

        return tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.completed }
        });
    });
}
