import { auth } from '@/auth';
import { stripe, isMissingOrInvalidConnectAccountError } from '@/lib/integrations/stripe';
import { prisma } from '@/lib/core/db';

/**
 * GET /api/shared/stripe/account
 * 
 * Get Stripe account info for current user.
 */
export async function GET() {
    const session = await auth();

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { stripeAccountId: true, stripeCustomerId: true },
    });

    if (!user) {
        return Response.json({ error: 'user_not_found' }, { status: 404 });
    }

    // If user has a connected Stripe account, get details
    if (user.stripeAccountId) {
        try {
            const account = await stripe.accounts.retrieve(user.stripeAccountId);
            return Response.json({
                accountId: account.id,
                payoutsEnabled: account.payouts_enabled,
                chargesEnabled: account.charges_enabled,
                detailsSubmitted: account.details_submitted,
            });
        } catch (error) {
            if (isMissingOrInvalidConnectAccountError(error)) {
                console.warn(
                    `[Stripe Account API] Stored Stripe account ${user.stripeAccountId} is invalid or missing. Returning disconnected state.`
                );
                return Response.json({
                    accountId: null,
                    customerId: user.stripeCustomerId,
                    payoutsEnabled: false,
                });
            }
            console.error('Error fetching Stripe account:', error);
            return Response.json({ error: 'stripe_error' }, { status: 500 });
        }
    }

    // Return customer info if no connected account
    return Response.json({
        accountId: null,
        customerId: user.stripeCustomerId,
        payoutsEnabled: false,
    });
}
