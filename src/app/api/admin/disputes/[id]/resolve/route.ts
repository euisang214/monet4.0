import { resolveDispute } from '@/lib/domain/admin/disputes';
import { getErrorMessage, getErrorStatus, withRoleContext } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { z } from 'zod';

const resolveSchema = z.object({
    resolution: z.string().min(1, 'Resolution notes required'),
    action: z.enum(['full_refund', 'partial_refund', 'dismiss']),
    refundAmountCents: z.number().int().positive().optional(),
}).refine(data => {
    if (data.action === 'partial_refund' && !data.refundAmountCents) {
        return false;
    }
    return true;
}, {
    message: "refundAmountCents is required for partial refunds",
    path: ["refundAmountCents"]
});

export const PUT = withRoleContext(
    Role.ADMIN,
    async (req: Request, { user }, { params }: { params: { id: string } }) => {
    const { id } = params;

    try {
        const body = await req.json();
        const result = resolveSchema.safeParse(body);

        if (!result.success) {
            return Response.json({ error: 'validation_error', details: result.error.issues }, { status: 400 });
        }

        const { resolution, action, refundAmountCents } = result.data;
        await resolveDispute(id, resolution, action, user.id, refundAmountCents);

        return Response.json({ success: true });
    } catch (error: unknown) {
        console.error('Error resolving dispute:', error);
        const status = getErrorStatus(error, 500);
        const message = getErrorMessage(error, 'internal_error');
        return Response.json({ error: message }, { status });
    }
});
