import { auth } from "@/auth";
import { prisma } from "@/lib/core/db";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

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
                },
            },
            professionalProfile: {
                select: {
                    employer: true,
                    title: true,
                    bio: true,
                    priceCents: true,
                    corporateEmail: true,
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
                initialCandidate={user.candidateProfile ?? undefined}
                initialProfessional={
                    user.professionalProfile
                        ? {
                              employer: user.professionalProfile.employer,
                              title: user.professionalProfile.title,
                              bio: user.professionalProfile.bio,
                              price: user.professionalProfile.priceCents / 100,
                              corporateEmail: user.professionalProfile.corporateEmail,
                          }
                        : undefined
                }
            />
        </main>
    );
}
