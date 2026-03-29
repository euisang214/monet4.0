"use client";

import { z } from "zod";
import { EducationSchema, ExperienceSchema } from "@/lib/types/profile-schemas";
import { normalizeTimezone } from "@/lib/utils/supported-timezones";
import {
    createEmptyEducationEntry,
    createEmptyExperienceEntry,
    ensureExactlyOneCurrentExperience,
    mapEducationEntries,
    mapTimelineEntries,
    normalizeCommaSeparated,
    type EducationEntry,
    type EducationFormEntry,
    type ExperienceFormEntry,
    type TimelineEntry,
} from "@/components/profile/shared/profileFormAdapters";

type CandidateProfileInitialValues = {
    firstName?: string | null;
    lastName?: string | null;
    timezone?: string | null;
    resumeUrl?: string | null;
    interests?: string[] | null;
    experience?: TimelineEntry[] | null;
    activities?: TimelineEntry[] | null;
    education?: EducationEntry[] | null;
};

type ProfessionalProfileInitialValues = {
    firstName?: string | null;
    lastName?: string | null;
    timezone?: string | null;
    bio?: string | null;
    price?: number | null;
    corporateEmail?: string | null;
    interests?: string[] | null;
    experience?: TimelineEntry[] | null;
    activities?: TimelineEntry[] | null;
    education?: EducationEntry[] | null;
};

function appendSchemaIssues(
    ctx: z.RefinementCtx,
    issues: z.ZodIssue[],
    pathPrefix: Array<string | number> = [],
) {
    for (const issue of issues) {
        ctx.addIssue({
            ...issue,
            path: [...pathPrefix, ...issue.path],
        });
    }
}

function toExperienceValidationInput(entry: ExperienceFormEntry) {
    return {
        company: entry.company.trim(),
        location: entry.location.trim() || null,
        startDate: entry.startDate,
        endDate: entry.isCurrent ? null : entry.endDate.trim() || null,
        isCurrent: entry.isCurrent,
        title: entry.title.trim(),
        description: entry.description.trim() || null,
        positionHistory: [],
    };
}

function toEducationValidationInput(entry: EducationFormEntry) {
    const gpaValue = entry.gpa.trim();
    const parsedGpa = gpaValue ? Number.parseFloat(gpaValue) : null;

    return {
        school: entry.school.trim(),
        location: entry.location.trim() || null,
        startDate: entry.startDate,
        endDate: entry.isCurrent ? null : entry.endDate.trim() || null,
        isCurrent: entry.isCurrent,
        degree: entry.degree.trim(),
        fieldOfStudy: entry.fieldOfStudy.trim(),
        gpa: Number.isFinite(parsedGpa) ? parsedGpa : null,
        honors: entry.honors.trim() || null,
        activities: normalizeCommaSeparated(entry.activities),
    };
}

const experienceFormEntrySchema = z
    .object({
        company: z.string(),
        title: z.string(),
        location: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        isCurrent: z.boolean(),
        description: z.string(),
    })
    .superRefine((entry, ctx) => {
        const parsed = ExperienceSchema.safeParse(toExperienceValidationInput(entry));
        if (!parsed.success) {
            appendSchemaIssues(ctx, parsed.error.issues);
        }
    });

const educationFormEntrySchema = z
    .object({
        school: z.string(),
        degree: z.string(),
        fieldOfStudy: z.string(),
        location: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        isCurrent: z.boolean(),
        gpa: z.string(),
        honors: z.string(),
        activities: z.string(),
    })
    .superRefine((entry, ctx) => {
        const parsed = EducationSchema.safeParse(toEducationValidationInput(entry));
        if (!parsed.success) {
            appendSchemaIssues(ctx, parsed.error.issues);
        }
    });

export const candidateProfileFormSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    timezone: z.string().trim().min(1, "Timezone is required."),
    resumeUrl: z.string().default(""),
    interestsText: z.string().trim().min(1, "At least one interest is required."),
    experience: z.array(experienceFormEntrySchema).min(1, "At least one experience entry is required."),
    activities: z.array(experienceFormEntrySchema).min(1, "At least one activity entry is required."),
    education: z.array(educationFormEntrySchema).min(1, "At least one education entry is required."),
}).superRefine((value, ctx) => {
    if (normalizeCommaSeparated(value.interestsText).length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["interestsText"],
            message: "At least one interest is required.",
        });
    }
});

export const professionalProfileFormSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required."),
    lastName: z.string().trim().min(1, "Last name is required."),
    timezone: z.string().trim().min(1, "Timezone is required."),
    bio: z.string().trim().min(1, "Bio is required."),
    price: z
        .string()
        .trim()
        .min(1, "Enter a valid hourly rate greater than zero.")
        .refine((value) => {
            const parsed = Number.parseFloat(value);
            return Number.isFinite(parsed) && parsed > 0;
        }, "Enter a valid hourly rate greater than zero."),
    corporateEmail: z
        .string()
        .trim()
        .min(1, "Corporate email is required.")
        .email("Enter a valid corporate email."),
    interestsText: z.string().trim().min(1, "At least one interest is required."),
    experience: z.array(experienceFormEntrySchema).min(1, "At least one experience entry is required."),
    activities: z.array(experienceFormEntrySchema).min(1, "At least one activity entry is required."),
    education: z.array(educationFormEntrySchema).min(1, "At least one education entry is required."),
}).superRefine((value, ctx) => {
    if (normalizeCommaSeparated(value.interestsText).length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["interestsText"],
            message: "At least one interest is required.",
        });
    }

    if (!ensureExactlyOneCurrentExperience(value.experience)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["experience"],
            message: "Select exactly one current role in your experience.",
        });
    }
});

export type CandidateProfileFormValues = z.infer<typeof candidateProfileFormSchema>;
export type CandidateProfileFormInput = z.input<typeof candidateProfileFormSchema>;
export type ProfessionalProfileFormValues = z.infer<typeof professionalProfileFormSchema>;

export function getCandidateProfileDefaultValues(
    initialData?: CandidateProfileInitialValues,
): CandidateProfileFormValues {
    return {
        firstName: initialData?.firstName || "",
        lastName: initialData?.lastName || "",
        timezone: normalizeTimezone(initialData?.timezone),
        resumeUrl: initialData?.resumeUrl || "",
        interestsText: initialData?.interests?.join(", ") || "",
        experience: mapTimelineEntries(initialData?.experience),
        activities: mapTimelineEntries(initialData?.activities),
        education: mapEducationEntries(initialData?.education),
    };
}

export function getProfessionalProfileDefaultValues(
    initialData?: ProfessionalProfileInitialValues,
): ProfessionalProfileFormValues {
    return {
        firstName: initialData?.firstName || "",
        lastName: initialData?.lastName || "",
        timezone: normalizeTimezone(initialData?.timezone),
        bio: initialData?.bio || "",
        price: typeof initialData?.price === "number" ? initialData.price.toString() : "",
        corporateEmail: initialData?.corporateEmail || "",
        interestsText: initialData?.interests?.join(", ") || "",
        experience: mapTimelineEntries(initialData?.experience, { enforceSingleCurrent: true }),
        activities: mapTimelineEntries(initialData?.activities),
        education: mapEducationEntries(initialData?.education),
    };
}

export function getProfileFormErrorMessage(error: unknown): string | null {
    if (!error) return null;

    if (typeof error === "object") {
        if (
            error !== null
            && "message" in error
            && typeof (error as { message?: unknown }).message === "string"
            && (error as { message: string }).message.trim()
        ) {
            return (error as { message: string }).message;
        }

        if (Array.isArray(error)) {
            for (const item of error) {
                const nestedMessage = getProfileFormErrorMessage(item);
                if (nestedMessage) return nestedMessage;
            }

            return null;
        }

        for (const value of Object.values(error as Record<string, unknown>)) {
            const nestedMessage = getProfileFormErrorMessage(value);
            if (nestedMessage) return nestedMessage;
        }
    }

    return null;
}

export function getTimelineDefaultEntry() {
    return createEmptyExperienceEntry();
}

export function getEducationDefaultEntry() {
    return createEmptyEducationEntry();
}
