import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { Role } from '@prisma/client';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Allow candidate or admin? Primarily candidate as per folder structure
    if (session.user.role !== Role.CANDIDATE) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const profile = await CandidateBrowse.getProfessionalDetails(id, session.user.id);
        if (!profile) {
            return Response.json({ error: 'not_found' }, { status: 404 });
        }
        return Response.json({ data: profile });
    } catch (error: any) {
        console.error('Profile fetch error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
