import { auth } from "@/auth";
import { getSignedResumeViewUrl } from "@/lib/integrations/resume-storage";
import { prisma } from "@/lib/core/db";
import { appRoutes } from "@/lib/shared/routes";
import { Role } from "@prisma/client";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const origin = new URL(request.url).origin;
    const session = await auth();

    if (!session?.user) {
        return Response.redirect(
            new URL(`/login?callbackUrl=${encodeURIComponent(appRoutes.professional.requestDetails(id))}`, origin),
            302,
        );
    }

    if (session.user.role !== Role.PROFESSIONAL) {
        return Response.redirect(new URL(appRoutes.professional.requests, origin), 302);
    }

    const booking = await prisma.booking.findUnique({
        where: { id },
        select: {
            professionalId: true,
            candidate: {
                select: {
                    candidateProfile: {
                        select: {
                            resumeUrl: true,
                        },
                    },
                },
            },
        },
    });

    if (!booking || booking.professionalId !== session.user.id) {
        return Response.redirect(new URL(appRoutes.professional.requests, origin), 302);
    }

    const resumeUrl = booking.candidate.candidateProfile?.resumeUrl;

    if (!resumeUrl) {
        return Response.json({ error: "not_found" }, { status: 404 });
    }

    const signedUrl = await getSignedResumeViewUrl(resumeUrl);
    return Response.redirect(signedUrl, 302);
}
