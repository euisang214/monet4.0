import { auth } from '@/auth';
import { Role } from '@prisma/client';
import { ProfessionalAvailability } from '@/lib/role/professional/availability';

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (session.user.role !== Role.PROFESSIONAL) {
        return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    try {
        const busyTimes = await ProfessionalAvailability.getBusyTimes(session.user.id);
        return Response.json({ data: busyTimes });
    } catch (error) {
        console.error('Professional busy times fetch error:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
