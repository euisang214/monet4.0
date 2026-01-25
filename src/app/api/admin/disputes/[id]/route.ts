import { prisma } from '@/lib/core/db';
import { withRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';

export const GET = withRole(Role.ADMIN, async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: {
            booking: {
                include: {
                    payment: true,
                    payout: true,
                    candidate: { select: { id: true, email: true } },
                    professional: { select: { id: true, email: true } }
                }
            },
            initiator: { select: { id: true, email: true } },
            resolvedBy: { select: { id: true, email: true } }
        }
    });

    if (!dispute) {
        return Response.json({ error: 'not_found' }, { status: 404 });
    }

    return Response.json({ data: dispute });
});