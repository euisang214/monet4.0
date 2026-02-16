import { auth } from '@/auth';
import { prisma } from '@/lib/core/db';
import { createResumeUrlSigner } from '@/lib/integrations/resume-storage';
import { Role } from '@prisma/client';

/**
 * GET /api/candidate/profile/[id]
 * 
 * Get candidate profile by ID.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
        where: { id, role: Role.CANDIDATE },
        include: {
            candidateProfile: true,
        },
    });

    if (!user || !user.candidateProfile) {
        return Response.json({ error: 'profile_not_found' }, { status: 404 });
    }

    const signResumeUrl = createResumeUrlSigner();
    user.candidateProfile.resumeUrl = (await signResumeUrl(user.candidateProfile.resumeUrl)) ?? null;

    return Response.json({
        id: user.id,
        email: user.email,
        profile: user.candidateProfile,
    });
}
