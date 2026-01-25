import { prisma } from '@/lib/core/db';
import { PayoutStatus } from '@prisma/client';

export const ProfessionalEarningsService = {
    /**
     * Returns earnings summary for a professional.
     */
    async getEarningsSummary(professionalId: string) {
        // 1. Calculate Total Payouts (Paid)
        // Sum of amountNet for all paid payouts
        const paidPayouts = await prisma.payout.aggregate({
            where: {
                proStripeAccountId: { not: undefined }, // Ensure it's linked (implicit via Booking->related Pro, but Payout has proStripeAccountId)
                // Wait, Payout model has proStripeAccountId, but doesn't strictly link to User ID here except via Booking. 
                // We should query via Booking -> Professional ID.
                booking: {
                    professionalId: professionalId
                },
                status: PayoutStatus.paid
            },
            _sum: {
                amountNet: true
            }
        });

        // 2. Calculate Pending Payouts
        const pendingPayouts = await prisma.payout.aggregate({
            where: {
                booking: {
                    professionalId: professionalId
                },
                status: PayoutStatus.pending
            },
            _sum: {
                amountNet: true
            }
        });

        return {
            totalEarningsCents: paidPayouts._sum.amountNet || 0,
            pendingPayoutsCents: pendingPayouts._sum.amountNet || 0
        };
    },

    /**
     * Returns payout history for a professional.
     */
    async getPayoutHistory(professionalId: string, limit: number = 20) {
        return await prisma.payout.findMany({
            where: {
                booking: { professionalId },
            },
            orderBy: { paidAt: 'desc' },
            take: limit,
            include: {
                booking: { select: { id: true, startAt: true } },
            },
        });
    }
};
