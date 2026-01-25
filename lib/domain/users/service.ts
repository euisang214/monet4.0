import { prisma } from "@/lib/core/db";
import { Prisma } from "@prisma/client";
import {
    ProfessionalProfileUpsertInput,
    CandidateProfileUpsertInput,
} from "@/lib/types/profile-schemas";

/**
 * Upserts a Professional Profile and replaces all related (owned) experience/education/activities.
 * Uses a transaction to ensure atomicity.
 */
export async function upsertProfessionalProfile(
    userId: string,
    data: ProfessionalProfileUpsertInput
) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Upsert the main profile
        const profile = await tx.professionalProfile.upsert({
            where: { userId },
            create: {
                userId,
                employer: data.employer,
                title: data.title,
                bio: data.bio,
                priceCents: data.priceCents,
                availabilityPrefs: data.availabilityPrefs as any,
                corporateEmail: data.corporateEmail,
                timezone: data.timezone,
                interests: data.interests,
            },
            update: {
                employer: data.employer,
                title: data.title,
                bio: data.bio,
                priceCents: data.priceCents,
                availabilityPrefs: data.availabilityPrefs as any,
                corporateEmail: data.corporateEmail,
                timezone: data.timezone,
                interests: data.interests,
            },
        });

        // 2. Handle Experience (Delete all existing for this profile and re-create)
        // Note: We use deleteMany with professionalId to clear old ones.
        await tx.experience.deleteMany({
            where: { professionalId: userId },
        });

        if (data.experience.length > 0) {
            await tx.experience.createMany({
                data: data.experience.map((exp) => ({
                    professionalId: userId,
                    company: exp.company,
                    location: exp.location,
                    startDate: exp.startDate,
                    endDate: exp.endDate,
                    isCurrent: exp.isCurrent,
                    title: exp.title,
                    description: exp.description,
                    positionHistory: exp.positionHistory,
                    type: "EXPERIENCE",
                })),
            });
        }

        // 3. Handle Education
        await tx.education.deleteMany({
            where: { professionalId: userId },
        });

        if (data.education.length > 0) {
            await tx.education.createMany({
                data: data.education.map((edu) => ({
                    professionalId: userId,
                    school: edu.school,
                    location: edu.location,
                    startDate: edu.startDate,
                    endDate: edu.endDate,
                    isCurrent: edu.isCurrent,
                    degree: edu.degree,
                    fieldOfStudy: edu.fieldOfStudy,
                    gpa: edu.gpa,
                    honors: edu.honors,
                    activities: edu.activities,
                })),
            });
        }

        // 4. Handle Activities (Mapped to Experience model with type='ACTIVITY')
        // We already deleted all experience for this pro above, effectively clearing activities too IF they share professionalId.
        // However, if we want to differentiate clean-up, we should have been more specific in deletion or careful in creation.
        // Since 'type' is on the Experience model, `deleteMany { professionalId: userId }` wiped both.
        // So we just create new ones now.

        // Note: If reusing 'Experience' model for activities, we assume 'company' maps to 'Activity Name' or similar?
        // The Schema has 'company' and 'title'. We'll map to those. 
        // If the input schema for activities uses ExperienceSchema, it has 'company'.
        if (data.activities.length > 0) {
            await tx.experience.createMany({
                data: data.activities.map((act) => ({
                    professionalId: userId,
                    company: act.company, // e.g., "Chess Club"
                    location: act.location,
                    startDate: act.startDate,
                    endDate: act.endDate,
                    isCurrent: act.isCurrent,
                    title: act.title, // e.g., "Member"
                    description: act.description,
                    positionHistory: act.positionHistory,
                    type: "ACTIVITY",
                })),
            });
        }

        return profile;
    });
}

/**
 * Upserts a Candidate Profile and replaced nested relations.
 */
export async function upsertCandidateProfile(
    userId: string,
    data: CandidateProfileUpsertInput
) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const profile = await tx.candidateProfile.upsert({
            where: { userId },
            create: {
                userId,
                resumeUrl: data.resumeUrl,
                interests: data.interests,
            },
            update: {
                resumeUrl: data.resumeUrl,
                interests: data.interests,
            },
        });

        // Handle Experience
        await tx.experience.deleteMany({
            where: { candidateId: userId },
        });
        if (data.experience.length > 0) {
            await tx.experience.createMany({
                data: data.experience.map(exp => ({
                    candidateId: userId,
                    company: exp.company,
                    location: exp.location,
                    startDate: exp.startDate,
                    endDate: exp.endDate,
                    isCurrent: exp.isCurrent,
                    title: exp.title,
                    description: exp.description,
                    positionHistory: exp.positionHistory,
                    type: "EXPERIENCE"
                }))
            });
        }

        // Handle Education
        await tx.education.deleteMany({
            where: { candidateId: userId },
        });
        if (data.education.length > 0) {
            await tx.education.createMany({
                data: data.education.map(edu => ({
                    candidateId: userId,
                    school: edu.school,
                    location: edu.location,
                    startDate: edu.startDate,
                    endDate: edu.endDate,
                    isCurrent: edu.isCurrent,
                    degree: edu.degree,
                    fieldOfStudy: edu.fieldOfStudy,
                    gpa: edu.gpa,
                    honors: edu.honors,
                    activities: edu.activities,
                }))
            });
        }

        // Handle Activities (Experience type=ACTIVITY)
        if (data.activities.length > 0) {
            await tx.experience.createMany({
                data: data.activities.map(act => ({
                    candidateId: userId,
                    company: act.company,
                    location: act.location,
                    startDate: act.startDate,
                    endDate: act.endDate,
                    isCurrent: act.isCurrent,
                    title: act.title,
                    description: act.description,
                    positionHistory: act.positionHistory,
                    type: "ACTIVITY"
                }))
            });
        }

        return profile;
    });
}

/**
 * Retrieves a Professional Profile.
 * Redacts identity information (email, corporateEmail) if the viewer (viewerId)
 * has NOT had a confirmed/completed booking with this professional.
 */
export async function getProfessionalProfile(
    userId: string,
    viewerId?: string // Optional: if null/undefined, assume unauthenticated guest -> Redacted
) {
    const profile = await prisma.professionalProfile.findUnique({
        where: { userId },
        include: {
            user: true, // Need user email
            experience: { where: { type: "EXPERIENCE" } },
            education: true,
            // We also need to fetch activities. Prisma relations are one-to-many.
            // We can fetch them via a separate query or filter in JS if we fetch all Experience.
            // But we filtered `experience` relation above.
            // Let's assume we want to return them separately.
            // Since the schema doesn't have a separate relation for activities, we can't easily include them in a separate property here without custom logic.
            // We will fix the return type to include them conceptually.
        },
    });

    if (!profile) return null;

    // Manual fetch for activities since they are stored in Experience table but semantically distinct
    const activities = await prisma.experience.findMany({
        where: { professionalId: userId, type: "ACTIVITY" }
    });

    // Determine if we should redact
    let showIdentity = false;

    if (viewerId === userId) {
        showIdentity = true; // Viewing own profile
    } else if (viewerId) {
        // Check for history
        const booking = await prisma.booking.findFirst({
            where: {
                professionalId: userId,
                candidateId: viewerId,
                status: { in: ['accepted', 'completed', 'completed_pending_feedback'] } // "Reveals identity after first booking" implies accepted/confirmed state? 
                // CLAUDE.md says: "Shows redacted profile if no booking history, reveals identity after first booking".
                // Strict interpretation: Has a booking existed? 
                // I'll assume 'accepted' or later status constitutes a valid booking establishment.
            }
        });
        if (booking) {
            showIdentity = true;
        }
    }

    if (!showIdentity) {
        return {
            ...profile,
            user: {
                ...profile.user,
                email: "REDACTED", // Redact User Email
                // Redact other sensitive fields from User if passed
            },
            corporateEmail: "REDACTED", // Redact Corporate Email
            activities,
            isRedacted: true
        };
    }

    return {
        ...profile,
        activities,
        isRedacted: false
    };
}
