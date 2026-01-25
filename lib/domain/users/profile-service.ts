import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
export const candidateProfileSchema = z.object({
    interests: z.array(z.string()).optional(),
    resumeUrl: z.string().url().optional(),
});

export const professionalProfileSchema = z.object({
    employer: z.string().optional(),
    title: z.string().optional(),
    bio: z.string().optional(),
    price: z.number().min(0).optional(), // Input as dollars (float)
    interests: z.array(z.string()).optional(),
});

export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;
export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;

export const ProfileService = {
    /**
     * Updates a candidate's profile.
     */
    async updateCandidateProfile(userId: string, data: CandidateProfileInput) {
        return await prisma.candidateProfile.upsert({
            where: { userId },
            create: {
                userId,
                ...data,
            },
            update: {
                ...data,
            },
        });
    },

    /**
     * Updates a professional's profile.
     * Handles price conversion from dollars to cents.
     */
    async updateProfessionalProfile(userId: string, data: ProfessionalProfileInput) {
        const { price, ...rest } = data;
        const updateData: Record<string, unknown> = { ...rest };

        // Convert price from dollars to cents if provided
        if (price !== undefined) {
            updateData.priceCents = Math.round(price * 100);
        }

        return await prisma.professionalProfile.upsert({
            where: { userId },
            create: {
                userId,
                priceCents: (updateData.priceCents as number) || 0,
                employer: (updateData.employer as string) || "",
                title: (updateData.title as string) || "",
                bio: (updateData.bio as string) || "",
                corporateEmail: "",
                ...rest,
            },
            update: updateData,
        });
    },

    /**
     * Gets a user's profile based on their role.
     * For professionals, converts priceCents to price in dollars.
     */
    async getProfileByUserId(userId: string, role: Role) {
        if (role === Role.CANDIDATE) {
            return await prisma.candidateProfile.findUnique({
                where: { userId }
            });
        } else if (role === Role.PROFESSIONAL) {
            const profile = await prisma.professionalProfile.findUnique({
                where: { userId }
            });
            // Convert cents to dollars for frontend
            if (profile) {
                return {
                    ...profile,
                    price: profile.priceCents / 100
                };
            }
            return null;
        }
        return null;
    }
};
