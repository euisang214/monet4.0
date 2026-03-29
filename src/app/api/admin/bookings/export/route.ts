import { prisma } from '@/lib/core/db';
import { exportTableToCsv } from '@/lib/core/admin-export';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';

export const GET = withRole(Role.ADMIN, async () => {
    const bookings = await prisma.booking.findMany({
        orderBy: { startAt: 'desc' },
    });

    const csv = exportTableToCsv(bookings);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="bookings.csv"',
        },
    });
});
