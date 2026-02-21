import { prisma } from "@/lib/core/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { createResumeUrlSigner } from "@/lib/integrations/resume-storage";
import {
    upsertCandidateProfile,
    upsertProfessionalProfile,
} from "@/lib/domain/users/service";
import { EducationSchema, ExperienceSchema } from "@/lib/types/profile-schemas";

export const candidateProfilePayloadSchema = z
    .object({
        resumeUrl: z.string().url("Invalid resume URL").optional(),
        interests: z.array(z.string().trim().min(1)).min(1, "At least one interest is required"),
        timezone: z.string().trim().min(1, "Timezone is required"),
        experience: z.array(ExperienceSchema).min(1, "At least one experience entry is required"),
        activities: z.array(ExperienceSchema).min(1, "At least one activity entry is required"),
        education: z.array(EducationSchema).min(1, "At least one education entry is required"),
    })
    .strict();

export const professionalProfilePayloadSchema = z
    .object({
        bio: z.string().trim().min(1, "Bio is required"),
        price: z.coerce.number().positive("Price must be greater than zero"),
        corporateEmail: z.string().email("Corporate email is invalid"),
        timezone: z.string().trim().min(1, "Timezone is required"),
        interests: z.array(z.string().trim().min(1)).min(1, "At least one interest is required"),
        experience: z.array(ExperienceSchema).min(1, "At least one experience entry is required"),
        activities: z.array(ExperienceSchema).min(1, "At least one activity entry is required"),
        education: z.array(EducationSchema).min(1, "At least one education entry is required"),
    })
    .strict()
    .superRefine((profile, ctx) => {
        const currentExperienceCount = profile.experience.filter((entry) => entry.isCurrent).length;
        if (currentExperienceCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["experience"],
                message: "Exactly one professional experience must be marked as current",
            });
        }
    });

export type CandidateProfilePayload = z.infer<typeof candidateProfilePayloadSchema>;
export type ProfessionalProfilePayload = z.infer<typeof professionalProfilePayloadSchema>;

export type CandidateProfileUpsertResult =
    | {
          success: true;
          resumeUrl: string;
      }
    | {
          success: false;
          error: "resume_required";
      };

function normalizeStringList(values: string[]) {
    return Array.from(
        new Set(
            values
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

function mapExperienceEntry(entry: CandidateProfilePayload["experience"][number]) {
    return {
        company: entry.company.trim(),
        location: entry.location?.trim() || null,
        startDate: entry.startDate,
        endDate: entry.isCurrent ? null : entry.endDate ?? null,
        isCurrent: entry.isCurrent,
        title: entry.title.trim(),
        description: entry.description?.trim() || null,
        positionHistory: entry.positionHistory ?? [],
    };
}

function mapEducationEntry(entry: CandidateProfilePayload["education"][number]) {
    return {
        school: entry.school.trim(),
        location: entry.location?.trim() || null,
        startDate: entry.startDate,
        endDate: entry.isCurrent ? null : entry.endDate ?? null,
        isCurrent: entry.isCurrent,
        degree: entry.degree.trim(),
        fieldOfStudy: entry.fieldOfStudy.trim(),
        gpa: entry.gpa ?? null,
        honors: entry.honors?.trim() || null,
        activities: normalizeStringList(entry.activities),
    };
}

export async function upsertCandidateProfileFromPayload(
    userId: string,
    payload: CandidateProfilePayload,
    options?: { markOnboardingCompleted?: boolean }
): Promise<CandidateProfileUpsertResult> {
    const existingProfile = await prisma.candidateProfile.findUnique({
        where: { userId },
        select: { resumeUrl: true },
    });

    const resumeUrl = payload.resumeUrl ?? existingProfile?.resumeUrl ?? null;

    if (!resumeUrl) {
        return {
            success: false,
            error: "resume_required",
        };
    }

    await upsertCandidateProfile(userId, {
        resumeUrl,
        interests: normalizeStringList(payload.interests),
        experience: payload.experience.map(mapExperienceEntry),
        activities: payload.activities.map(mapExperienceEntry),
        education: payload.education.map(mapEducationEntry),
    });

    const userUpdateData: Prisma.UserUpdateInput = {
        timezone: payload.timezone,
    };

    if (options?.markOnboardingCompleted) {
        userUpdateData.onboardingCompleted = true;
    }

    await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
    });

    return {
        success: true,
        resumeUrl,
    };
}

export async function upsertProfessionalProfileFromPayload(
    userId: string,
    payload: ProfessionalProfilePayload,
    options?: { markOnboardingCompleted?: boolean }
) {
    const existingProfile = await prisma.professionalProfile.findUnique({
        where: { userId },
        select: { availabilityPrefs: true },
    });

    await upsertProfessionalProfile(userId, {
        bio: payload.bio.trim(),
        priceCents: Math.round(payload.price * 100),
        availabilityPrefs: (existingProfile?.availabilityPrefs ?? {}) as Record<string, unknown>,
        corporateEmail: payload.corporateEmail.trim(),
        timezone: payload.timezone,
        interests: normalizeStringList(payload.interests),
        experience: payload.experience.map(mapExperienceEntry),
        activities: payload.activities.map(mapExperienceEntry),
        education: payload.education.map(mapEducationEntry),
    });

    const userUpdateData: Prisma.UserUpdateInput = {
        timezone: payload.timezone,
    };

    if (options?.markOnboardingCompleted) {
        userUpdateData.onboardingCompleted = true;
    }

    await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
    });
}

export function buildResumeRequiredValidationError() {
    return {
        error: "validation_error",
        details: {
            fieldErrors: {
                resumeUrl: ["Resume is required"],
            },
            formErrors: [],
        },
    };
}

export async function getCandidateProfileForSettings(userId: string) {
    const profile = await prisma.candidateProfile.findUnique({
        where: { userId },
        include: {
            experience: {
                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
            },
            activities: {
                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
            },
            education: {
                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
            },
        },
    });

    if (!profile) {
        return null;
    }

    const signResumeUrl = createResumeUrlSigner();
    const resumeViewUrl = (await signResumeUrl(profile.resumeUrl)) ?? null;

    return {
        ...profile,
        resumeViewUrl,
    };
}
