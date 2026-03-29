import { prisma } from '@/lib/core/db';
import { exportTableToCsv } from '@/lib/core/admin-export';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';

export const GET = withRole(Role.ADMIN, async () => {
    const payouts = await prisma.payout.findMany({
        orderBy: { createdAt: 'desc' },
    });

    const csv = exportTableToCsv(payouts);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="payouts.csv"',
        },
    });
});
