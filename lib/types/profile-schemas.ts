import { z } from "zod";

// Base schemas corresponding to Prisma models
export const ExperienceSchema = z.object({
    company: z.string().min(1, "Company is required"),
    location: z.string().nullable().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    isCurrent: z.boolean().default(false),
    title: z.string().min(1, "Title is required"),
    description: z.string().nullable().optional(),
    // For simplicity in upsert, we handle positionHistory as a JSON compatible array if needed, 
    // but strictly it's a Json field. We'll simplify to array of objects for input.
    positionHistory: z
        .array(
            z.object({
                title: z.string(),
                startDate: z.string().or(z.date()), // Accept string for easier API input
                endDate: z.string().or(z.date()).nullable(),
            })
        )
        .optional()
        .default([]),
});

export const EducationSchema = z.object({
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
});

export const ProfessionalProfileUpsertSchema = z.object({
    employer: z.string().min(1, "Employer is required"),
    title: z.string().min(1, "Title is required"),
    bio: z.string().min(1, "Bio is required"),
    priceCents: z.number().int().nonnegative("Price must be non-negative"),
    availabilityPrefs: z.record(z.string(), z.any()).default({}), // Json field
    corporateEmail: z.string().email("Invalid corporate email"),
    timezone: z.string().default("UTC"),
    interests: z.array(z.string()).default([]),

    // Relations to upsert
    experience: z.array(ExperienceSchema).default([]),
    education: z.array(EducationSchema).default([]),
    // Note: "activities" in Prisma schema are mapped to Experience model. 
    // We will expose them as a separate array for the API but merge them in service or handle as 'Experience' with type.
    // However, strict Schema adherence shows 'activities' on Profile models as 'Experience[]'.
    // We'll separate them here for clarity if the UI distinguishes them.
    activities: z.array(ExperienceSchema).default([]),
});

export const CandidateProfileUpsertSchema = z.object({
    resumeUrl: z.string().url().nullable().optional(),
    interests: z.array(z.string()).default([]),

    // Relations
    experience: z.array(ExperienceSchema).default([]),
    education: z.array(EducationSchema).default([]),
    activities: z.array(ExperienceSchema).default([]),
});

export type ProfessionalProfileUpsertInput = z.infer<typeof ProfessionalProfileUpsertSchema>;
export type CandidateProfileUpsertInput = z.infer<typeof CandidateProfileUpsertSchema>;
export type ExperienceInput = z.infer<typeof ExperienceSchema>;
export type EducationInput = z.infer<typeof EducationSchema>;
