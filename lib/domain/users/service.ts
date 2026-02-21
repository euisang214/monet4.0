import { prisma } from "@/lib/core/db";
import { Prisma } from "@prisma/client";
import {
    ProfessionalProfileUpsertInput,
    CandidateProfileUpsertInput,
} from "@/lib/types/profile-schemas";
import { deriveCurrentRoleFromExperiences } from "@/lib/domain/users/current-role";

function assertExactlyOneCurrentExperience(entries: ProfessionalProfileUpsertInput["experience"]) {
    const currentCount = entries.filter((entry) => entry.isCurrent).length;
    if (currentCount !== 1) {
        throw new Error("Professional profile must include exactly one current experience");
    }
}

/**
 * Upserts a Professional Profile and replaces all related (owned) experience/education/activities.
 * Uses a transaction to ensure atomicity.
 */
export async function upsertProfessionalProfile(
    userId: string,
    data: ProfessionalProfileUpsertInput
) {
    assertExactlyOneCurrentExperience(data.experience);

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const profile = await tx.professionalProfile.upsert({
            where: { userId },
            create: {
                userId,
                bio: data.bio,
                priceCents: data.priceCents,
                availabilityPrefs: data.availabilityPrefs as Prisma.InputJsonValue,
                corporateEmail: data.corporateEmail,
                timezone: data.timezone,
                interests: data.interests,
            },
            update: {
                bio: data.bio,
                priceCents: data.priceCents,
                availabilityPrefs: data.availabilityPrefs as Prisma.InputJsonValue,
                corporateEmail: data.corporateEmail,
                timezone: data.timezone,
                interests: data.interests,
            },
        });

        await tx.experience.deleteMany({
            where: { OR: [{ professionalId: userId }, { professionalActivityId: userId }] },
        });

        if (data.experience.length > 0) {
            await tx.experience.createMany({
                data: data.experience.map((exp) => ({
                    professionalId: userId,
                    company: exp.company,
                    location: exp.location,
                    startDate: exp.startDate,
                    endDate: exp.isCurrent ? null : exp.endDate,
                    isCurrent: exp.isCurrent,
                    title: exp.title,
                    description: exp.description,
                    positionHistory: exp.positionHistory,
                    type: "EXPERIENCE",
                })),
            });
        }

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
                    endDate: edu.isCurrent ? null : edu.endDate,
                    isCurrent: edu.isCurrent,
                    degree: edu.degree,
                    fieldOfStudy: edu.fieldOfStudy,
                    gpa: edu.gpa,
                    honors: edu.honors,
                    activities: edu.activities,
                })),
            });
        }

        if (data.activities.length > 0) {
            await tx.experience.createMany({
                data: data.activities.map((act) => ({
                    professionalActivityId: userId,
                    company: act.company,
                    location: act.location,
                    startDate: act.startDate,
                    endDate: act.isCurrent ? null : act.endDate,
                    isCurrent: act.isCurrent,
                    title: act.title,
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

        await tx.experience.deleteMany({
            where: { OR: [{ candidateId: userId }, { candidateActivityId: userId }] },
        });

        if (data.experience.length > 0) {
            await tx.experience.createMany({
                data: data.experience.map((exp) => ({
                    candidateId: userId,
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

        await tx.education.deleteMany({
            where: { candidateId: userId },
        });

        if (data.education.length > 0) {
            await tx.education.createMany({
                data: data.education.map((edu) => ({
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
                })),
            });
        }

        if (data.activities.length > 0) {
            await tx.experience.createMany({
                data: data.activities.map((act) => ({
                    candidateActivityId: userId,
                    company: act.company,
                    location: act.location,
                    startDate: act.startDate,
                    endDate: act.endDate,
                    isCurrent: act.isCurrent,
                    title: act.title,
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
 * Retrieves a Professional Profile.
 * Redacts identity information (email, corporateEmail) if the viewer (viewerId)
 * has NOT had a confirmed/completed booking with this professional.
 */
export async function getProfessionalProfile(
    userId: string,
    viewerId?: string
) {
    const profile = await prisma.professionalProfile.findUnique({
        where: { userId },
        include: {
            user: true,
            experience: {
                where: { type: "EXPERIENCE" },
                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
            },
            activities: {
                where: { type: "ACTIVITY" },
                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
            },
            education: {
                orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }, { id: "desc" }],
            },
        },
    });

    if (!profile) return null;

    const currentRole = deriveCurrentRoleFromExperiences(profile.experience);

    let showIdentity = false;

    if (viewerId === userId) {
        showIdentity = true;
    } else if (viewerId) {
        const booking = await prisma.booking.findFirst({
            where: {
                professionalId: userId,
                candidateId: viewerId,
                status: { in: ["accepted", "completed", "completed_pending_feedback"] },
            },
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
                email: "REDACTED",
            },
            corporateEmail: "REDACTED",
            title: currentRole.title,
            employer: currentRole.employer,
            isRedacted: true,
        };
    }

    return {
        ...profile,
        title: currentRole.title,
        employer: currentRole.employer,
        isRedacted: false,
    };
}
