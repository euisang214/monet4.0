import { BookingStatus, PaymentStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import { addHours } from 'date-fns';
import { stripe } from '@/lib/integrations/stripe';
import { notificationsQueue } from '@/lib/queues';
import { calculatePlatformFee } from '@/lib/domain/payments/utils';
import { createAuditLog } from '@/lib/shared/audit';
import { TransitionConflictError, TransitionError } from '../errors';
import { defaultPrisma, transitionBooking, type Dependencies } from './shared';

export async function createBookingRequest(
    candidateId: string,
    professionalId: string,
    weeks: number,
    deps: Dependencies & { stripe?: typeof stripe } = { prisma: defaultPrisma, stripe }
) {
    const candidate = await deps.prisma.user.findUniqueOrThrow({ where: { id: candidateId } });
    if (candidate.role !== Role.CANDIDATE) throw new TransitionError("User is not a candidate");

    const professional = await deps.prisma.professionalProfile.findUniqueOrThrow({
        where: { userId: professionalId },
        include: { user: true }
    });

    const amountCents = professional.priceCents;
    const platformFee = calculatePlatformFee(amountCents);

    const paymentIntent = await deps.stripe!.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        capture_method: 'manual',
        automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'never',
        },
        metadata: {
            candidateId,
            professionalId,
            type: 'booking_request'
        }
    });

    const runInTransaction = async (tx: Prisma.TransactionClient) => {
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

        await tx.payment.create({
            data: {
                bookingId: booking.id,
                amountGross: amountCents,
                platformFee: platformFee,
                stripePaymentIntentId: paymentIntent.id,
                status: PaymentStatus.authorized,
            }
        });

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

        try {
            await deps.stripe!.paymentIntents.update(paymentIntent.id, {
                metadata: { bookingId: booking.id }
            });
        } catch (error) {
            console.error("Failed to update PI metadata", error);
        }

        return {
            booking,
            clientSecret: paymentIntent.client_secret,
            stripePaymentIntentId: paymentIntent.id
        };
    };

    let result;

    if ('$transaction' in deps.prisma) {
        result = await (deps.prisma as PrismaClient).$transaction(runInTransaction);
    } else {
        result = await runInTransaction(deps.prisma as Prisma.TransactionClient);
    }

    await notificationsQueue.add('notifications', {
        type: 'booking_requested',
        bookingId: result.booking.id,
    });

    return result;
}

export async function declineBooking(
    bookingId: string,
    actor: { userId: string; role: Role },
    reason: string,
    deps: Dependencies = { prisma: defaultPrisma }
) {
    if (actor.role !== Role.PROFESSIONAL) {
        throw new TransitionError('Only professionals can decline bookings');
    }

    let transitioned = false;

    const result = await transitionBooking(bookingId, BookingStatus.declined, { actor, reason }, deps, async (tx) => {
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });

        if (booking.professionalId !== actor.userId) {
            throw new TransitionError('Not authorized to decline this booking');
        }

        if (booking.status === BookingStatus.declined) {
            if (booking.declineReason && booking.declineReason !== reason) {
                throw new TransitionConflictError('Booking already declined with a different reason');
            }
            return booking;
        }

        if (booking.status !== BookingStatus.requested) {
            throw new TransitionError(`Cannot decline booking in state ${booking.status}`);
        }

        transitioned = true;
        const updated = await tx.booking.update({
            where: { id: bookingId },
            data: {
                status: BookingStatus.declined,
                declineReason: reason,
            },
        });

        await tx.payment.updateMany({
            where: { bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.cancelled },
        });

        return updated;
    });

    if (transitioned) {
        await notificationsQueue.add('notifications', {
            type: 'booking_declined',
            bookingId,
        });
    }

    return result;
}

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
            where: { bookingId, status: PaymentStatus.authorized },
            data: { status: PaymentStatus.cancelled },
        });

        return updated;
    });
}
