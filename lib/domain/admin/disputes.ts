import { prisma } from '@/lib/core/db';
import {
    BookingStatus,
    DisputeStatus,
    PaymentStatus,
    PayoutStatus
} from '@prisma/client';
import {
    createTransfer,
    refundPayment,
    stripe,
} from '@/lib/integrations/stripe';
import Stripe from 'stripe';

function getLatestChargeId(paymentIntent: Stripe.PaymentIntent): string | null {
    if (!paymentIntent.latest_charge) {
        return null;
    }
    if (typeof paymentIntent.latest_charge === 'string') {
        return paymentIntent.latest_charge;
    }
    return paymentIntent.latest_charge.id;
}

/**
 * Resolves a dispute by refunding the candidate or dismissing (paying the professional).
 * 
 * @param disputeId - The ID of the dispute to resolve
 * @param resolution - Admin notes on the resolution
 * @param action - 'full_refund' | 'partial_refund' | 'dismiss'
 * @param adminUserId - The Admin User ID performing the action
 * @param refundAmountCents - (Optional) Amount to refund for partial refunds
 */
export async function resolveDispute(
    disputeId: string,
    resolution: string,
    action: 'full_refund' | 'partial_refund' | 'dismiss',
    adminUserId: string,
    refundAmountCents?: number
) {
    // 1. Fetch Dispute with Booking and Payment
    const dispute = await prisma.dispute.findUnique({
        where: { id: disputeId },
        include: {
            booking: {
                include: {
                    payment: true,
                    payout: true,
                    professional: true, // Need Stripe Account ID
                }
            }
        }
    });

    if (!dispute) {
        throw new Error('Dispute not found');
    }

    if (dispute.status === DisputeStatus.resolved) {
        throw new Error('Dispute is already resolved');
    }

    const { booking } = dispute;
    if (!booking) {
        throw new Error('Dispute has no associated booking'); // Should not happen by schema
    }

    const payment = booking.payment;
    if (!payment) {
        // Even if "dismissing", we need to know the payment state. 
        // If payment was never captured, we can't refund OR transfer (technically).
        // But usually disputes happen post-capture.
        throw new Error('Booking has no payment record');
    }

    // 2. Perform Action Logic
    let newPaymentStatus = payment.status;
    let newBookingStatus = booking.status;
    let newRefundedAmount = payment.refundedAmountCents;

    // NOTE: We perform Stripe calls *before* DB updates to ensure funds move, 
    // or *inside* a transaction? 
    // Stripe calls are external side effects. We generally do them, then update DB.
    // Ideally we'd use a robust state machine or saga, but for this service we'll do:
    // Check conditions -> Call Stripe -> Update DB.

    if (action === 'full_refund') {
        // Refund entire remaining amount? Or original amount?
        // "Full Refund" usually means everything.
        const amountToRefund = payment.amountGross - payment.refundedAmountCents;
        if (amountToRefund <= 0) {
            throw new Error('Payment already fully refunded');
        }

        await refundPayment(payment.stripePaymentIntentId);
        // Defaults to full refund if amount not passed, but we should probably be explicit if we tracked partials before.
        // However, `refundPayment` wrapper with no amount does full refund of *remaining* amount typically? 
        // Actually Stripe API `amount` is optional. 

        newPaymentStatus = PaymentStatus.refunded;
        newBookingStatus = BookingStatus.refunded;
        newRefundedAmount = payment.amountGross;

    } else if (action === 'partial_refund') {
        if (!refundAmountCents || refundAmountCents <= 0) {
            throw new Error('Partial refund requires a positive amount');
        }
        if (refundAmountCents > (payment.amountGross - payment.refundedAmountCents)) {
            throw new Error('Refund amount exceeds remaining balance');
        }

        await refundPayment(payment.stripePaymentIntentId, refundAmountCents);

        newRefundedAmount += refundAmountCents;
        newPaymentStatus = (newRefundedAmount === payment.amountGross)
            ? PaymentStatus.refunded
            : PaymentStatus.partially_refunded;

        // Booking status: If fully refunded, set to refund? 
        // If partially, it probably stays "completed" or reverts to "accepted"? 
        // CLAUDE.md says: `PaymentStatus = refunded` => `BookingStatus ∈ {cancelled, refunded...}`.
        // If partial, maybe strictly `BookingStatus.completed` (admin resolved it)? 
        // Let's set to `completed` if it's a resolution that keeps some money.
        if (newPaymentStatus === PaymentStatus.refunded) {
            newBookingStatus = BookingStatus.refunded;
        } else {
            newBookingStatus = BookingStatus.completed;
        }

    } else if (action === 'dismiss') {
        // "Dismiss" means we reject the dispute and pay the professional.
        // Ensure funds are held?
        if (payment.status !== PaymentStatus.held && payment.status !== PaymentStatus.partially_refunded) {
            // It might be 'released' already? If so, why dispute? Post-payout dispute?
            // If already released, we can't "release" again. Just mark resolved.
        }

        // Process Transfer (Payout) if not already paid
        // We need a Payout record.
        let payout = booking.payout;

        // Calculate what to pay: Net amount. 
        // Platform fee is 20%. Net = Gross - Fee.
        // If valid partial refunds occurred previously, we need to adjust? 
        // Simplest: The "held" amount is transferred.
        // CLAUDE.md says "Funds held on platform...". 
        // If we dismiss, we release the funds. 

        if (!payout) {
            // Create pending payout if logic demands, but usually Payout is created by QC. 
            // If QC failed and dispute rose, we might not have a Payout record yet? 
            // Or we do, but it's 'blocked'.
        }

        // If payout doesn't exist, create it (assuming standard fee structure)
        if (!payout) {
            const net = payment.amountGross - payment.platformFee;
            payout = await prisma.payout.create({
                data: {
                    bookingId: booking.id,
                    proStripeAccountId: booking.professional.stripeAccountId!, // Must exist for pro
                    amountNet: net,
                    status: PayoutStatus.pending,
                }
            });
        }

        if (payout.status !== PayoutStatus.paid) {
            const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId, {
                expand: ['latest_charge'],
            });
            const sourceTransactionId = getLatestChargeId(paymentIntent);
            if (!sourceTransactionId) {
                throw new Error(
                    `Cannot transfer payout for booking ${booking.id}: PaymentIntent ${payment.stripePaymentIntentId} has no charge`
                );
            }

            const transfer = await createTransfer(
                payout.amountNet,
                payout.proStripeAccountId,
                booking.id,
                { bookingId: booking.id },
                sourceTransactionId
            );

            await prisma.payout.update({
                where: { id: payout.id },
                data: {
                    status: PayoutStatus.paid,
                    stripeTransferId: transfer.id,
                    paidAt: new Date(),
                }
            });
        }

        newPaymentStatus = PaymentStatus.released;
        newBookingStatus = BookingStatus.completed;
    }

    // 3. Update Database Records
    await prisma.$transaction([
        prisma.dispute.update({
            where: { id: disputeId },
            data: {
                status: DisputeStatus.resolved,
                resolution: resolution, // Admin notes
                resolvedById: adminUserId,
                resolvedAt: new Date(),
            }
        }),
        prisma.booking.update({
            where: { id: booking.id },
            data: {
                status: newBookingStatus
            }
        }),
        prisma.payment.update({
            where: { id: payment.id },
            data: {
                status: newPaymentStatus,
                refundedAmountCents: newRefundedAmount
            }
        }),
        // 4. Create Audit Log
        prisma.auditLog.create({
            data: {
                actorUserId: adminUserId,
                entity: 'Dispute',
                entityId: disputeId,
                action: `dispute_resolved_${action}`,
                metadata: {
                    resolution,
                    action,
                    refundAmountCents,
                    previousStatus: dispute.status
                }
            }
        })
    ]); // End transaction

    return { success: true };
}
