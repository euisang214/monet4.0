import { resolveDispute } from '@/lib/domain/admin/disputes';
import { getErrorMessage, getErrorStatus, withRole } from '@/lib/core/api-helpers';
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

export const PUT = withRole(Role.ADMIN, async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    try {
        const body = await req.json();
        const result = resolveSchema.safeParse(body);

        if (!result.success) {
            return Response.json({ error: 'validation_error', details: result.error.issues }, { status: 400 });
        }

        const { resolution, action, refundAmountCents } = result.data;

        // Use a placeholder or actual admin ID from session?
        // withRole endpoint wrapper verifies role but inside handler we might need the ID.
        // withRole doesn't pass session user down directly in the wrapper signature I see in CLAUDE.md?
        // Wait, the `withRole` signature in CLAUDE.md was:
        // `export const GET = withRole(['ADMIN'], async (session, req) => { ... });`
        // BUT the snippet I read in `api-helpers.ts` was:
        // `export function withRole(role: Role, handler: ApiHandler) { return async (req, ...args) => { ... } }`
        // It does NOT pass session to handler! It just calls `handler(req, ...args)`.
        // So I need to call `auth()` again or modify `withRole` to pass it? 
        // `currentUser()` creates overhead. `auth()` is cached?
        // Let's call `auth()`/`currentUser()` again inside since `withRole` is just a guard.

        // Actually, `lib/core/api-helpers.ts` snippet (Line 38) calls `return handler(req, ...args)`.
        // It does NOT modify arguments.
        // So I must fetch user again.

        const { auth } = await import('@/auth');
        const session = await auth();
        const adminUserId = session?.user?.id;

        if (!adminUserId) {
            return Response.json({ error: 'unauthorized' }, { status: 401 });
        }

        await resolveDispute(id, resolution, action, adminUserId, refundAmountCents);

        return Response.json({ success: true });
    } catch (error: unknown) {
        console.error('Error resolving dispute:', error);
        const status = getErrorStatus(error, 500);
        const message = getErrorMessage(error, 'internal_error');
        return Response.json({ error: message }, { status });
    }
});
