import { auth } from "@/auth";
import { prisma } from "@/lib/core/db";
import { Role } from "@prisma/client";
import { z } from "zod";

const candidateOnboardingSchema = z.object({
    resumeUrl: z.string().url("Invalid resume URL"),
    interests: z.array(z.string().trim().min(1)).min(1, "At least one interest is required"),
    timezone: z.string().trim().min(1, "Timezone is required"),
});

const professionalOnboardingSchema = z.object({
    employer: z.string().trim().min(1, "Employer is required"),
    title: z.string().trim().min(1, "Title is required"),
    bio: z.string().trim().min(1, "Bio is required"),
    price: z.number().positive("Price must be greater than zero"),
    corporateEmail: z.string().email("Corporate email is invalid"),
    timezone: z.string().trim().min(1, "Timezone is required"),
});

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

            const { resumeUrl, interests, timezone } = parsed.data;

            await prisma.$transaction(async (tx) => {
                await tx.candidateProfile.upsert({
                    where: { userId },
                    create: {
                        userId,
                        resumeUrl,
                        interests,
                    },
                    update: {
                        resumeUrl,
                        interests,
                    },
                });

                await tx.user.update({
                    where: { id: userId },
                    data: {
                        timezone,
                        onboardingCompleted: true,
                    },
                });
            });
        } else if (role === Role.PROFESSIONAL) {
            const parsed = professionalOnboardingSchema.safeParse(body);
            if (!parsed.success) {
                return Response.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
            }

            const { employer, title, bio, price, corporateEmail, timezone } = parsed.data;
            const priceCents = Math.round(price * 100);

            await prisma.$transaction(async (tx) => {
                await tx.professionalProfile.upsert({
                    where: { userId },
                    create: {
                        userId,
                        employer,
                        title,
                        bio,
                        priceCents,
                        corporateEmail,
                        timezone,
                        interests: [],
                        availabilityPrefs: {},
                    },
                    update: {
                        employer,
                        title,
                        bio,
                        priceCents,
                        corporateEmail,
                        timezone,
                    },
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
