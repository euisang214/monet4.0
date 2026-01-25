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

    if (session.user.role !== Role.CANDIDATE) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const reviews = await CandidateBrowse.getProfessionalReviews(id);
        return Response.json({ data: reviews });
    } catch (error: any) {
        console.error('Reviews fetch error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
