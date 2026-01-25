import { stripe } from '@/lib/integrations/stripe';
import { confirmPaymentInDb, handlePaymentFailure } from '@/lib/integrations/stripe/confirm';
import Stripe from 'stripe';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: Request) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
        return Response.json({ error: 'Missing signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`[STRIPE WEBHOOK] Payment succeeded: ${paymentIntent.id}`);
                await confirmPaymentInDb(paymentIntent.id);
                break;
            }
            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log(`[STRIPE WEBHOOK] Payment failed: ${paymentIntent.id}`);
                await handlePaymentFailure(paymentIntent.id);
                break;
            }
            default:
                // Unhandled event type
                // console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
                break;
        }
    } catch (error) {
        console.error(`[STRIPE WEBHOOK] Error handling event ${event.type}:`, error);
        // We still return 200 to acknowledge receipt, relying on logs for debugging
        // unless it's a critical system failure where we WANT Stripe to retry.
        // For logic errors (e.g. payment not found), retying might not help, but for DB connection issues it would.
        // Let's return 500 if it's an error we want to retry.
        if (error instanceof Error && error.message.includes('Payment not found')) {
            // If payment not found, maybe race condition with creation? Allow retry.
            return Response.json({ error: 'Processing failed', details: error.message }, { status: 500 });
        }
        return Response.json({ error: 'Processing failed' }, { status: 500 });
    }

    return Response.json({ received: true });
}
