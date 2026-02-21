import { prisma } from '@/lib/core/db';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { upsertProfessionalProfile } from '@/lib/domain/users/service';
import { EducationSchema, ExperienceSchema } from '@/lib/types/profile-schemas';
import { deriveCurrentRoleFromExperiences } from '@/lib/domain/users/current-role';
import { isSupportedTimezone } from '@/lib/utils/supported-timezones';

export const candidateProfileSchema = z.object({
    interests: z.array(z.string()).optional(),
    resumeUrl: z.string().url().optional(),
});

export const professionalProfileSchema = z
    .object({
        bio: z.string().trim().min(1, 'Bio is required'),
        price: z.coerce.number().min(0, 'Price must be non-negative'),
        corporateEmail: z.string().email('Corporate email is invalid'),
        interests: z.array(z.string().trim().min(1)).min(1, 'At least one interest is required'),
        timezone: z.string().trim().refine(isSupportedTimezone, 'Select a valid timezone'),
        experience: z.array(ExperienceSchema).min(1, 'At least one experience entry is required'),
        activities: z.array(ExperienceSchema).min(1, 'At least one activity entry is required'),
        education: z.array(EducationSchema).min(1, 'At least one education entry is required'),
    })
    .strict()
    .superRefine((profile, ctx) => {
        const currentCount = profile.experience.filter((entry) => entry.isCurrent).length;
        if (currentCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['experience'],
                message: 'Exactly one professional experience must be marked as current',
            });
        }
    });

export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;
export type ProfessionalProfileInput = z.infer<typeof professionalProfileSchema>;

export const ProfileService = {
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

    async updateProfessionalProfile(userId: string, data: ProfessionalProfileInput) {
        const existingProfile = await prisma.professionalProfile.findUnique({
            where: { userId },
            select: { availabilityPrefs: true },
        });

        return await upsertProfessionalProfile(userId, {
            bio: data.bio,
            priceCents: Math.round(data.price * 100),
            availabilityPrefs: (existingProfile?.availabilityPrefs ?? {}) as Record<string, unknown>,
            corporateEmail: data.corporateEmail,
            timezone: data.timezone,
            interests: data.interests,
            experience: data.experience,
            activities: data.activities,
            education: data.education,
        });
    },

    async getProfileByUserId(userId: string, role: Role) {
        if (role === Role.CANDIDATE) {
            return await prisma.candidateProfile.findUnique({
                where: { userId },
            });
        }

        if (role === Role.PROFESSIONAL) {
            const profile = await prisma.professionalProfile.findUnique({
                where: { userId },
                include: {
                    experience: {
                        where: { type: 'EXPERIENCE' },
                        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                    },
                    activities: {
                        where: { type: 'ACTIVITY' },
                        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                    },
                    education: {
                        orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                    },
                },
            });

            if (!profile) {
                return null;
            }

            const currentRole = deriveCurrentRoleFromExperiences(profile.experience);

            return {
                ...profile,
                price: profile.priceCents / 100,
                title: currentRole.title,
                employer: currentRole.employer,
            };
        }

        return null;
    },
};
