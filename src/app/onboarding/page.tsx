import { auth } from "@/auth";
import { prisma } from "@/lib/core/db";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

function toDateInputValue(value: Date | null | undefined) {
    if (!value) return "";
    return value.toISOString().slice(0, 10);
}

function roleHomePath(role: Role) {
    if (role === Role.PROFESSIONAL) return "/professional/dashboard";
    if (role === Role.CANDIDATE) return "/candidate/browse";
    return "/";
}

export default async function OnboardingPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/login?callbackUrl=/onboarding");
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id: true,
            role: true,
            timezone: true,
            onboardingRequired: true,
            onboardingCompleted: true,
            candidateProfile: {
                select: {
                    resumeUrl: true,
                    interests: true,
                    experience: {
                        orderBy: { startDate: "desc" },
                        select: {
                            company: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                            title: true,
                            description: true,
                        },
                    },
                    activities: {
                        orderBy: { startDate: "desc" },
                        select: {
                            company: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                            title: true,
                            description: true,
                        },
                    },
                    education: {
                        orderBy: { startDate: "desc" },
                        select: {
                            school: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                            degree: true,
                            fieldOfStudy: true,
                            gpa: true,
                            honors: true,
                            activities: true,
                        },
                    },
                },
            },
            professionalProfile: {
                select: {
                    bio: true,
                    priceCents: true,
                    corporateEmail: true,
                    interests: true,
                    experience: {
                        orderBy: { startDate: "desc" },
                        select: {
                            company: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                            title: true,
                            description: true,
                        },
                    },
                    activities: {
                        orderBy: { startDate: "desc" },
                        select: {
                            company: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                            title: true,
                            description: true,
                        },
                    },
                    education: {
                        orderBy: { startDate: "desc" },
                        select: {
                            school: true,
                            location: true,
                            startDate: true,
                            endDate: true,
                            isCurrent: true,
                            degree: true,
                            fieldOfStudy: true,
                            gpa: true,
                            honors: true,
                            activities: true,
                        },
                    },
                },
            },
        },
    });

    if (!user) {
        redirect("/login");
    }

    if (!user.onboardingRequired || user.onboardingCompleted) {
        redirect(roleHomePath(user.role));
    }

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-12">
            <OnboardingForm
                role={user.role}
                initialTimezone={user.timezone || "UTC"}
                initialCandidate={
                    user.candidateProfile
                        ? {
                              resumeUrl: user.candidateProfile.resumeUrl,
                              interests: user.candidateProfile.interests,
                              experience: user.candidateProfile.experience.map((entry) => ({
                                  company: entry.company,
                                  location: entry.location,
                                  startDate: toDateInputValue(entry.startDate),
                                  endDate: toDateInputValue(entry.endDate),
                                  isCurrent: entry.isCurrent,
                                  title: entry.title,
                                  description: entry.description,
                              })),
                              activities: user.candidateProfile.activities.map((entry) => ({
                                  company: entry.company,
                                  location: entry.location,
                                  startDate: toDateInputValue(entry.startDate),
                                  endDate: toDateInputValue(entry.endDate),
                                  isCurrent: entry.isCurrent,
                                  title: entry.title,
                                  description: entry.description,
                              })),
                              education: user.candidateProfile.education.map((entry) => ({
                                  school: entry.school,
                                  location: entry.location,
                                  startDate: toDateInputValue(entry.startDate),
                                  endDate: toDateInputValue(entry.endDate),
                                  isCurrent: entry.isCurrent,
                                  degree: entry.degree,
                                  fieldOfStudy: entry.fieldOfStudy,
                                  gpa: entry.gpa,
                                  honors: entry.honors,
                                  activities: entry.activities,
                              })),
                          }
                        : undefined
                }
                initialProfessional={
                    user.professionalProfile
                        ? {
                              bio: user.professionalProfile.bio,
                              price: user.professionalProfile.priceCents / 100,
                              corporateEmail: user.professionalProfile.corporateEmail,
                              interests: user.professionalProfile.interests,
                              experience: user.professionalProfile.experience.map((entry) => ({
                                  company: entry.company,
                                  location: entry.location,
                                  startDate: toDateInputValue(entry.startDate),
                                  endDate: toDateInputValue(entry.endDate),
                                  isCurrent: entry.isCurrent,
                                  title: entry.title,
                                  description: entry.description,
                              })),
                              activities: user.professionalProfile.activities.map((entry) => ({
                                  company: entry.company,
                                  location: entry.location,
                                  startDate: toDateInputValue(entry.startDate),
                                  endDate: toDateInputValue(entry.endDate),
                                  isCurrent: entry.isCurrent,
                                  title: entry.title,
                                  description: entry.description,
                              })),
                              education: user.professionalProfile.education.map((entry) => ({
                                  school: entry.school,
                                  location: entry.location,
                                  startDate: toDateInputValue(entry.startDate),
                                  endDate: toDateInputValue(entry.endDate),
                                  isCurrent: entry.isCurrent,
                                  degree: entry.degree,
                                  fieldOfStudy: entry.fieldOfStudy,
                                  gpa: entry.gpa,
                                  honors: entry.honors,
                                  activities: entry.activities,
                              })),
                          }
                        : undefined
                }
            />
        </main>
    );
}
