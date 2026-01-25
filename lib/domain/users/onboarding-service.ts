import { prisma } from '@/lib/core/db';
import { createConnectAccount, createAccountLink } from '@/lib/integrations/stripe';

/**
 * OnboardingService - Professional Stripe Connect onboarding
 * 
 * Consolidates logic from:
 * - /src/app/api/professional/onboarding/route.ts
 */
export const OnboardingService = {
    /**
     * Generate a Stripe Connect onboarding link for a professional
     * Creates the Connect account if it doesn't exist (idempotent)
     * 
     * @param userId - The professional user ID
     * @param returnUrl - URL to redirect after successful onboarding
     * @param refreshUrl - URL to redirect if account link expires
     * @returns The Stripe AccountLink URL
     */
    async generateOnboardingLink(
        userId: string,
        returnUrl: string,
        refreshUrl: string
    ): Promise<{ url: string }> {
        // Fetch user with Stripe account info
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, stripeAccountId: true },
        });

        if (!user) {
            throw new Error('user_not_found');
        }

        let accountId = user.stripeAccountId;

        // Create Stripe Connect account if it doesn't exist (idempotent)
        if (!accountId) {
            const account = await createConnectAccount(user.email);
            accountId = account.id;

            // Persist the new account ID
            await prisma.user.update({
                where: { id: userId },
                data: { stripeAccountId: accountId },
            });
        }

        // Generate Account Link for onboarding
        const accountLink = await createAccountLink(accountId, returnUrl, refreshUrl);

        return { url: accountLink.url };
    },
};
