import { auth } from '@/auth';
import { CandidateBrowse } from '@/lib/role/candidate/browse';
import { Role } from '@prisma/client';

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.CANDIDATE) {
        // Strictly enforcing role access as per directory structure
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const listings = await CandidateBrowse.searchProfessionals();
        return Response.json({ data: listings });
    } catch (error: any) {
        console.error('Search error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
