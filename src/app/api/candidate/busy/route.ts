import { auth } from '@/auth';
import { CandidateAvailability } from '@/lib/role/candidate/availability';
import { Role } from '@prisma/client';

export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.CANDIDATE) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const busyTimes = await CandidateAvailability.getBusyTimes(session.user.id);
        return Response.json({ data: busyTimes });
    } catch (error: any) {
        console.error('Busy times fetch error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
