import { prisma } from '@/lib/core/db';
import { exportTableToCsv } from '@/lib/core/admin-export';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';

export const GET = withRole(Role.ADMIN, async () => {
    const users = await prisma.user.findMany({
        orderBy: { email: 'asc' },
        // Select specific fields for security/privacy or dump all? 
        // Admin export usually implies full dump, but exclude sensitive hash
        select: {
            id: true,
            email: true,
            role: true,
            googleCalendarConnected: true,
            linkedinConnected: true,
            corporateEmailVerified: true,
            timezone: true,
            stripeCustomerId: true,
            stripeAccountId: true,
            // Exclude hashedPassword
        }
    });

    const csv = exportTableToCsv(users);

    return new Response(csv, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="users.csv"',
        },
    });
});
