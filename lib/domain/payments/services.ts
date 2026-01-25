import { prisma } from '@/lib/core/db';
import { createTransfer, refundPayment } from '@/lib/integrations/stripe';
import { PayoutStatus, PaymentStatus, BookingStatus } from '@prisma/client';
import { notificationsQueue } from '@/lib/queues';

export const PaymentsService = {
    /**
     * Processes a Payout job for a given booking.
     * 1. Checks idempotency (is it already paid?).
     * 2. Executes Stripe Transfer.
     * 3. Updates Payout status to 'paid'.
     */
    async processPayoutJob(bookingId: string) {
        const payout = await prisma.payout.findUnique({
            where: { bookingId },
            include: {
                booking: true, // Need booking for transfer group? generic booking data?
            },
        });

        if (!payout) {
            throw new Error(`Payout record not found for booking ${bookingId}`);
        }

        // 1. Idempotency Check
        if (payout.status === PayoutStatus.paid) {
            console.log(`[PAYMENTS] Payout for booking ${bookingId} already PAID. Skipping.`);
            return { processed: true, status: 'already_paid' };
        }

        if (payout.status === PayoutStatus.blocked) {
            console.log(`[PAYMENTS] Payout for booking ${bookingId} is BLOCKED. Skipping.`);
            return { processed: true, status: 'blocked' };
        }

        if (!payout.proStripeAccountId || payout.proStripeAccountId === 'MISSING_ACCOUNT') {
            throw new Error(`Missing Stripe Account ID for payout ${payout.id}`);
        }

        // 2. Execute Stripe Transfer
        console.log(`[PAYMENTS] Transferring $${payout.amountNet / 100} to ${payout.proStripeAccountId}...`);

        // We use booking ID as transfer group to link charges and transfers
        const transfer = await createTransfer(
            payout.amountNet,
            payout.proStripeAccountId,
            bookingId, // Transfer Group
            { bookingId } // Metadata
        );

        // 3. Update Payout Status
        await prisma.payout.update({
            where: { id: payout.id },
            data: {
                status: PayoutStatus.paid,
                stripeTransferId: transfer.id,
                paidAt: new Date(),
            }
        });

        console.log(`[PAYMENTS] Payout ${payout.id} marked as PAID.`);

        await notificationsQueue.add('notifications', {
            type: 'payout_released',
            payoutId: payout.id,
        });

        return { processed: true, transferId: transfer.id };
    },

    /**
     * Processes a manual refund for a booking (Admin action).
     * 1. Validates booking and payment exist.
     * 2. Checks refundable amount.
     * 3. Executes Stripe refund.
     * 4. Updates Payment and Booking status.
     * 5. Creates audit log.
     */
    async processManualRefund(bookingId: string, amountCents?: number, adminUserId?: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { payment: true },
        });

        if (!booking) {
            throw new Error('booking_not_found');
        }

        if (!booking.payment) {
            throw new Error('payment_not_found');
        }

        const { payment } = booking;

        // Verify refund is possible
        const refundable = payment.amountGross - payment.refundedAmountCents;
        if (refundable <= 0) {
            throw new Error('already_fully_refunded');
        }

        if (amountCents && amountCents > refundable) {
            throw new Error('amount_exceeds_refundable');
        }

        // Call Stripe
        const refund = await refundPayment(payment.stripePaymentIntentId, amountCents);

        // Update DB
        const newRefundedTotal = payment.refundedAmountCents + (refund.amount || (amountCents ?? refundable));
        const newStatus = (newRefundedTotal >= payment.amountGross)
            ? PaymentStatus.refunded
            : PaymentStatus.partially_refunded;

        // Update booking status if full refund
        let newBookingStatus = booking.status;
        if (newStatus === PaymentStatus.refunded) {
            newBookingStatus = BookingStatus.refunded;
        }

        await prisma.$transaction([
            prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: newStatus,
                    refundedAmountCents: newRefundedTotal,
                    stripeRefundId: refund.id,
                }
            }),
            prisma.booking.update({
                where: { id: booking.id },
                data: { status: newBookingStatus }
            }),
            prisma.auditLog.create({
                data: {
                    entity: 'Payment',
                    entityId: payment.id,
                    action: 'manual_refund',
                    metadata: { bookingId, amountCents, stripeRefundId: refund.id },
                    actorUserId: adminUserId,
                }
            })
        ]);

        return { success: true, stripeRefundId: refund.id };
    }
};
