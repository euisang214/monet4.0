import { prisma } from "@/lib/core/db";
import { isMissingOrInvalidConnectAccountError, stripe } from "@/lib/integrations/stripe";

export type ProfessionalStripeStatus = {
    accountId: string | null;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    isPayoutReady: boolean;
};

export async function getProfessionalStripeStatus(userId: string): Promise<ProfessionalStripeStatus> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { stripeAccountId: true },
    });

    if (!user?.stripeAccountId) {
        return {
            accountId: null,
            payoutsEnabled: false,
            chargesEnabled: false,
            detailsSubmitted: false,
            isPayoutReady: false,
        };
    }

    try {
        const account = await stripe.accounts.retrieve(user.stripeAccountId);

        return {
            accountId: account.id,
            payoutsEnabled: account.payouts_enabled,
            chargesEnabled: account.charges_enabled,
            detailsSubmitted: account.details_submitted,
            isPayoutReady: Boolean(account.id) && account.payouts_enabled,
        };
    } catch (error) {
        if (isMissingOrInvalidConnectAccountError(error)) {
            console.warn(
                `[ProfessionalStripeStatus] Stored Stripe account ${user.stripeAccountId} is invalid or missing. Returning disconnected state.`
            );

            return {
                accountId: null,
                payoutsEnabled: false,
                chargesEnabled: false,
                detailsSubmitted: false,
                isPayoutReady: false,
            };
        }

        throw error;
    }
}
