import { prisma } from '@/lib/core/db';
import { exportTableToCsv } from '@/lib/core/admin-export';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';

export const GET = withRole(Role.ADMIN, async () => {
    const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
    });

    // Convert JSON metadata to string
    const validLogs = logs.map(l => ({
        ...l,
        metadata: JSON.stringify(l.metadata)
    }));


    const csv = exportTableToCsv(validLogs);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="audit_logs.csv"',
        },
    });
});
