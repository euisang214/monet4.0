import { prisma } from '@/lib/core/db';
import { exportTableToCsv } from '@/lib/core/admin-export';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';

export const GET = withRole(Role.ADMIN, async () => {
    const disputes = await prisma.dispute.findMany({
        orderBy: { createdAt: 'desc' },
    });

    const csv = exportTableToCsv(disputes);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="disputes.csv"',
        },
    });
});
