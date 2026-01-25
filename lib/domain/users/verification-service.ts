import { prisma } from '@/lib/core/db';
import { sendVerificationEmail } from '@/lib/integrations/email';
import { Verification } from '@prisma/client';

/**
 * VerificationService - Centralized email verification logic
 * 
 * Consolidates logic from:
 * - /src/app/api/shared/verification/request/route.ts
 * - /src/app/api/shared/verification/confirm/route.ts
 * - /src/app/api/shared/verification/status/route.ts
 */
export const VerificationService = {
    /**
     * Create a new verification request and send email
     * @param userId - The user requesting verification
     * @param corporateEmail - The corporate email to verify
     */
    async createVerification(userId: string, corporateEmail: string): Promise<Verification> {
        // Generate 6-character alphanumeric token
        const token = Math.random().toString(36).substring(2, 8).toUpperCase();

        // Create Verification record
        const verification = await prisma.verification.create({
            data: {
                userId,
                corporateEmail,
                token,
            },
        });

        // Send verification email
        await sendVerificationEmail(corporateEmail, token);

        return verification;
    },

    /**
     * Confirm a verification token
     * Performs atomic 3-table update: Verification, ProfessionalProfile, User
     * @param userId - The user confirming verification
     * @param token - The verification token
     * @throws Error if token is invalid or expired (24 hours)
     */
    async confirmVerification(userId: string, token: string): Promise<void> {
        // Find valid token for this user (not expired, not used)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const verification = await prisma.verification.findFirst({
            where: {
                userId,
                token,
                createdAt: { gt: twentyFourHoursAgo },
                verifiedAt: null, // Only unused tokens
            },
        });

        if (!verification) {
            throw new Error('invalid_code');
        }

        // Atomic 3-table update using transaction
        await prisma.$transaction(async (tx) => {
            // 1. Update Verification record
            await tx.verification.update({
                where: { id: verification.id },
                data: { verifiedAt: new Date() },
            });

            // 2. Update ProfessionalProfile
            await tx.professionalProfile.update({
                where: { userId },
                data: {
                    corporateEmail: verification.corporateEmail,
                    verifiedAt: new Date(),
                },
            });

            // 3. Update User
            await tx.user.update({
                where: { id: userId },
                data: { corporateEmailVerified: true },
            });
        });
    },

    /**
     * Get the current verification status for a user
     * @param userId - The user to check
     * @returns The most recent verification record or null
     */
    async getVerificationStatus(userId: string): Promise<{
        verified: boolean;
        verifiedAt: Date | null;
        corporateEmail: string | null;
    }> {
        const verification = await prisma.verification.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        return {
            verified: !!verification?.verifiedAt,
            verifiedAt: verification?.verifiedAt ?? null,
            corporateEmail: verification?.corporateEmail ?? null,
        };
    },
};
