import { prisma } from '@/lib/core/db';
import { exportTableToCsv } from '@/lib/core/admin-export';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';

export const GET = withRole(Role.ADMIN, async () => {
    const feedback = await prisma.callFeedback.findMany({
        orderBy: { submittedAt: 'desc' },
    });

    // Convert array fields (actions) to string for CSV
    const validFeedback = feedback.map(f => ({
        ...f,
        actions: f.actions.join('; ')
    }));

    const csv = exportTableToCsv(validFeedback);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="feedback.csv"',
        },
    });
});
