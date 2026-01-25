import { prisma } from '@/lib/core/db';
import { withRole } from '@/lib/core/api-helpers';
import { Role, DisputeStatus } from '@prisma/client';
import { NextRequest } from 'next/server';

export const GET = withRole(Role.ADMIN, async (req: Request) => {
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const status = searchParams.get('status') as DisputeStatus | null;

    const disputes = await prisma.dispute.findMany({
        where: status ? { status } : undefined,
        include: {
            booking: true,
            initiator: {
                select: {
                    id: true,
                    email: true,
                    role: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
    });

    return Response.json({ data: disputes });
});
