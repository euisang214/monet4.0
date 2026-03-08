import { BookingStatus } from '@prisma/client';
import { prisma } from '@/lib/core/db';
import { expireBooking } from '@/lib/domain/bookings/transitions';
import { cancelPaymentIntent } from '@/lib/integrations/stripe';

export async function processExpiryCheck() {
    console.log('[BOOKINGS] Processing Expiry Check');

    const expiredBookings = await prisma.booking.findMany({
        where: {
            status: BookingStatus.requested,
            expiresAt: { lt: new Date() },
        },
        include: { payment: true },
        take: 50,
    });

    console.log(`[BOOKINGS] Found ${expiredBookings.length} bookings to expire`);

    for (const booking of expiredBookings) {
        try {
            console.log(`[BOOKINGS] Expiring booking ${booking.id}`);

            if (booking.payment?.stripePaymentIntentId) {
                try {
                    await cancelPaymentIntent(booking.payment.stripePaymentIntentId);
                    console.log(`[BOOKINGS] Cancelled PI ${booking.payment.stripePaymentIntentId}`);
                } catch (err: any) {
                    if (err.code === 'resource_missing') {
                        console.warn(`[BOOKINGS] PI ${booking.payment.stripePaymentIntentId} not found or already cancelled.`);
                    } else if (err.code === 'payment_intent_unexpected_state') {
                        console.warn(`[BOOKINGS] PI ${booking.payment.stripePaymentIntentId} in unexpected state: ${err.message}`);
                    } else {
                        console.error(`[BOOKINGS] Failed to cancel PI for booking ${booking.id}`, err);
                    }
                }
            }

            await expireBooking(booking.id);
        } catch (error) {
            console.error(`[BOOKINGS] Failed to expire booking ${booking.id}`, error);
        }
    }

    return { processed: true, count: expiredBookings.length };
}
