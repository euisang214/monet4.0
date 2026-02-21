import { auth } from "@/auth";
import { prisma } from "@/lib/core/db";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";

const optionalDateSchema = z.preprocess((value) => {
    if (value === "" || value === null || typeof value === "undefined") {
        return undefined;
    }
    return value;
}, z.coerce.date().optional());

const optionalNumberSchema = z.preprocess((value) => {
    if (value === "" || value === null || typeof value === "undefined") {
        return undefined;
    }
    if (typeof value === "string") {
        return Number.parseFloat(value);
    }
    return value;
}, z.number().finite().optional());

const timelineEntrySchema = z
    .object({
        company: z.string().trim().min(1, "Company is required"),
        location: z.string().trim().optional().nullable(),
        startDate: z.coerce.date(),
        endDate: optionalDateSchema,
        isCurrent: z.boolean().optional().default(false),
        title: z.string().trim().min(1, "Title is required"),
        description: z.string().trim().optional().nullable(),
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

const educationEntrySchema = z
    .object({
        school: z.string().trim().min(1, "School is required"),
        location: z.string().trim().optional().nullable(),
        startDate: z.coerce.date(),
        endDate: optionalDateSchema,
        isCurrent: z.boolean().optional().default(false),
        degree: z.string().trim().min(1, "Degree is required"),
        fieldOfStudy: z.string().trim().min(1, "Field of study is required"),
        gpa: optionalNumberSchema,
        honors: z.string().trim().optional().nullable(),
        activities: z.array(z.string().trim().min(1)).optional().default([]),
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

const candidateOnboardingSchema = z
    .object({
        resumeUrl: z.string().url("Invalid resume URL").optional(),
        interests: z.array(z.string().trim().min(1)).min(1, "At least one interest is required"),
        timezone: z.string().trim().min(1, "Timezone is required"),
        experience: z.array(timelineEntrySchema).min(1, "At least one experience entry is required"),
        activities: z.array(timelineEntrySchema).min(1, "At least one activity entry is required"),
        education: z.array(educationEntrySchema).min(1, "At least one education entry is required"),
    })
    .strict();

const professionalOnboardingSchema = z
    .object({
        bio: z.string().trim().min(1, "Bio is required"),
        price: z.number().positive("Price must be greater than zero"),
        corporateEmail: z.string().email("Corporate email is invalid"),
        timezone: z.string().trim().min(1, "Timezone is required"),
        interests: z.array(z.string().trim().min(1)).min(1, "At least one interest is required"),
        experience: z.array(timelineEntrySchema).min(1, "At least one experience entry is required"),
        activities: z.array(timelineEntrySchema).min(1, "At least one activity entry is required"),
        education: z.array(educationEntrySchema).min(1, "At least one education entry is required"),
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

type TimelineEntryInput = z.infer<typeof timelineEntrySchema>;
type EducationEntryInput = z.infer<typeof educationEntrySchema>;

function normalizeStringList(values: string[]) {
    return Array.from(
        new Set(
            values
                .map((value) => value.trim())
                .filter(Boolean)
        )
    );
}

function buildExperienceValues(entry: TimelineEntryInput, type: "EXPERIENCE" | "ACTIVITY") {
    return {
        company: entry.company.trim(),
        location: entry.location?.trim() || null,
        startDate: entry.startDate,
        endDate: entry.isCurrent ? null : entry.endDate ?? null,
        isCurrent: entry.isCurrent,
        title: entry.title.trim(),
        description: entry.description?.trim() || null,
        positionHistory: [],
        type,
    } satisfies Omit<
        Prisma.ExperienceCreateManyInput,
        "candidateId" | "professionalId" | "candidateActivityId" | "professionalActivityId" | "id"
    >;
}

function mapCandidateExperienceEntries(entries: TimelineEntryInput[], userId: string): Prisma.ExperienceCreateManyInput[] {
    return entries.map((entry) => ({
        candidateId: userId,
        ...buildExperienceValues(entry, "EXPERIENCE"),
    }));
}

function mapCandidateActivityEntries(entries: TimelineEntryInput[], userId: string): Prisma.ExperienceCreateManyInput[] {
    return entries.map((entry) => ({
        candidateActivityId: userId,
        ...buildExperienceValues(entry, "ACTIVITY"),
    }));
}

function mapProfessionalExperienceEntries(
    entries: TimelineEntryInput[],
    userId: string
): Prisma.ExperienceCreateManyInput[] {
    return entries.map((entry) => ({
        professionalId: userId,
        ...buildExperienceValues(entry, "EXPERIENCE"),
    }));
}

function mapProfessionalActivityEntries(
    entries: TimelineEntryInput[],
    userId: string
): Prisma.ExperienceCreateManyInput[] {
    return entries.map((entry) => ({
        professionalActivityId: userId,
        ...buildExperienceValues(entry, "ACTIVITY"),
    }));
}

function buildEducationValues(entry: EducationEntryInput) {
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
    } satisfies Omit<Prisma.EducationCreateManyInput, "candidateId" | "professionalId" | "id">;
}

function mapCandidateEducationEntries(entries: EducationEntryInput[], userId: string): Prisma.EducationCreateManyInput[] {
    return entries.map((entry) => ({
        candidateId: userId,
        ...buildEducationValues(entry),
    }));
}

function mapProfessionalEducationEntries(
    entries: EducationEntryInput[],
    userId: string
): Prisma.EducationCreateManyInput[] {
    return entries.map((entry) => ({
        professionalId: userId,
        ...buildEducationValues(entry),
    }));
}

export async function POST(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const userId = session.user.id;
        const role = session.user.role;

        if (role === Role.CANDIDATE) {
            const parsed = candidateOnboardingSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            const existingProfile = await prisma.candidateProfile.findUnique({
                where: { userId },
                select: { resumeUrl: true },
            });
            const resumeUrl = parsed.data.resumeUrl ?? existingProfile?.resumeUrl;

            if (!resumeUrl) {
                return Response.json(
                    {
                        error: "validation_error",
                        details: {
                            fieldErrors: {
                                resumeUrl: ["Resume is required"],
                            },
                            formErrors: [],
                        },
                    },
                    { status: 400 }
                );
            }

            await prisma.$transaction(async (tx) => {
                await tx.candidateProfile.upsert({
                    where: { userId },
                    create: {
                        userId,
                        resumeUrl,
                        interests: normalizeStringList(parsed.data.interests),
                    },
                    update: {
                        resumeUrl,
                        interests: normalizeStringList(parsed.data.interests),
                    },
                });

                await tx.experience.deleteMany({
                    where: {
                        OR: [{ candidateId: userId }, { candidateActivityId: userId }],
                    },
                });

                await tx.experience.createMany({
                    data: mapCandidateExperienceEntries(parsed.data.experience, userId),
                });

                await tx.experience.createMany({
                    data: mapCandidateActivityEntries(parsed.data.activities, userId),
                });

                await tx.education.deleteMany({
                    where: { candidateId: userId },
                });

                await tx.education.createMany({
                    data: mapCandidateEducationEntries(parsed.data.education, userId),
                });

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        timezone: parsed.data.timezone,
                        onboardingCompleted: true,
                    },
                });
            });
        } else if (role === Role.PROFESSIONAL) {
            const parsed = professionalOnboardingSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            const { bio, price, corporateEmail, timezone } = parsed.data;
            const priceCents = Math.round(price * 100);

            await prisma.$transaction(async (tx) => {
                await tx.professionalProfile.upsert({
                    where: { userId },
                    create: {
                        userId,
                        bio,
                        priceCents,
                        corporateEmail,
                        timezone,
                        interests: normalizeStringList(parsed.data.interests),
                        availabilityPrefs: {},
                    },
                    update: {
                        bio,
                        priceCents,
                        corporateEmail,
                        timezone,
                        interests: normalizeStringList(parsed.data.interests),
                    },
                });

                await tx.experience.deleteMany({
                    where: {
                        OR: [{ professionalId: userId }, { professionalActivityId: userId }],
                    },
                });

                await tx.experience.createMany({
                    data: mapProfessionalExperienceEntries(parsed.data.experience, userId),
                });

                await tx.experience.createMany({
                    data: mapProfessionalActivityEntries(parsed.data.activities, userId),
                });

                await tx.education.deleteMany({
                    where: { professionalId: userId },
                });

                await tx.education.createMany({
                    data: mapProfessionalEducationEntries(parsed.data.education, userId),
                });

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        timezone,
                        onboardingCompleted: true,
                    },
                });
            });
        } else {
            return Response.json({ error: "unsupported_role" }, { status: 400 });
        }

        const updatedUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                onboardingRequired: true,
                onboardingCompleted: true,
            },
        });

        return Response.json({
            data: {
                success: true,
                onboardingRequired: updatedUser?.onboardingRequired ?? false,
                onboardingCompleted: updatedUser?.onboardingCompleted ?? true,
            },
        });
    } catch (error) {
        console.error("Onboarding completion error:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
