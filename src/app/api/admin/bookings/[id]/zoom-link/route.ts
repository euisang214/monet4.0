import { withRole } from '@/lib/core/api-helpers';
import { updateZoomDetails } from '@/lib/domain/bookings/transitions';
import { Role } from '@prisma/client';
import { z } from 'zod';

const zoomLinkSchema = z.object({
    zoomJoinUrl: z.string().url(),
    zoomMeetingId: z.string().optional(),
});

/**
 * PUT /api/admin/bookings/[id]/zoom-link
 * 
 * Admin fallback for manually updating Zoom meeting details.
 * Delegates to updateZoomDetails from booking transitions.
 */
export const PUT = withRole(Role.ADMIN, async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    try {
        const body = await req.json();
        const result = zoomLinkSchema.safeParse(body);

        if (!result.success) {
            return Response.json({ error: 'validation_error', details: result.error.issues }, { status: 400 });
        }

        // Get the authenticated user from the withRole wrapper
        // Note: withRole ensures we have an admin user
        const { auth } = await import('@/auth');
        const session = await auth();

        if (!session?.user) {
            return Response.json({ error: 'unauthorized' }, { status: 401 });
        }

        await updateZoomDetails(
            id,
            result.data.zoomJoinUrl,
            result.data.zoomMeetingId,
            { userId: session.user.id, role: Role.ADMIN }
        );

        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Error updating zoom link:', error);
        return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
    }
});
