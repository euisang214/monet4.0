import { z } from "zod";

// Base schemas corresponding to Prisma models
export const ExperienceSchema = z
    .object({
        company: z.string().min(1, "Company is required"),
        location: z.string().nullable().optional(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().nullable().optional(),
        isCurrent: z.boolean().default(false),
        title: z.string().min(1, "Title is required"),
        description: z.string().nullable().optional(),
        positionHistory: z
            .array(
                z.object({
                    title: z.string(),
                    startDate: z.string().or(z.date()),
                    endDate: z.string().or(z.date()).nullable(),
                })
            )
            .optional()
            .default([]),
    })
    .superRefine((entry, ctx) => {
        if (entry.endDate && entry.endDate < entry.startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "End date cannot be before start date",
            });
        }
    });

export const EducationSchema = z
    .object({
        school: z.string().min(1, "School is required"),
        location: z.string().nullable().optional(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date().nullable().optional(),
        isCurrent: z.boolean().default(false),
        degree: z.string().min(1, "Degree is required"),
        fieldOfStudy: z.string().min(1, "Field of study is required"),
        gpa: z.number().nullable().optional(),
        honors: z.string().nullable().optional(),
        activities: z.array(z.string()).default([]),
    })
    .superRefine((entry, ctx) => {
        if (entry.endDate && entry.endDate < entry.startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["endDate"],
                message: "End date cannot be before start date",
            });
        }
    });

export const ProfessionalProfileUpsertSchema = z
    .object({
        bio: z.string().min(1, "Bio is required"),
        priceCents: z.number().int().nonnegative("Price must be non-negative"),
        availabilityPrefs: z.record(z.string(), z.any()).default({}),
        corporateEmail: z.string().email("Invalid corporate email"),
        timezone: z.string().default("UTC"),
        interests: z.array(z.string()).min(1, "At least one interest is required"),
        experience: z.array(ExperienceSchema).min(1, "At least one experience entry is required"),
        education: z.array(EducationSchema).min(1, "At least one education entry is required"),
        activities: z.array(ExperienceSchema).min(1, "At least one activity entry is required"),
    })
    .superRefine((profile, ctx) => {
        const currentCount = profile.experience.filter((entry) => entry.isCurrent).length;
        if (currentCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["experience"],
                message: "Exactly one professional experience must be marked as current",
            });
        }
    });

export const CandidateProfileUpsertSchema = z.object({
    resumeUrl: z.string().url().nullable().optional(),
    interests: z.array(z.string()).default([]),
    experience: z.array(ExperienceSchema).default([]),
    education: z.array(EducationSchema).default([]),
    activities: z.array(ExperienceSchema).default([]),
});

export type ProfessionalProfileUpsertInput = z.infer<typeof ProfessionalProfileUpsertSchema>;
export type CandidateProfileUpsertInput = z.infer<typeof CandidateProfileUpsertSchema>;
export type ExperienceInput = z.infer<typeof ExperienceSchema>;
export type EducationInput = z.infer<typeof EducationSchema>;
