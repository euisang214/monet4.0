import { withRoleContext } from '@/lib/core/api-helpers';
import { updateZoomDetails } from '@/lib/domain/bookings/transitions';
import { Role } from '@prisma/client';
import { z } from 'zod';

const zoomLinkSchema = z.object({
    zoomJoinUrl: z.string().url().optional(),
    zoomMeetingId: z.string().optional(),
    candidateZoomJoinUrl: z.string().url().optional(),
    professionalZoomJoinUrl: z.string().url().optional(),
}).superRefine((data, ctx) => {
    const hasAnyJoinUrl = Boolean(
        data.zoomJoinUrl
        || data.candidateZoomJoinUrl
        || data.professionalZoomJoinUrl
    );
    if (!hasAnyJoinUrl) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'At least one Zoom join URL is required',
            path: ['zoomJoinUrl'],
        });
    }
});

/**
 * PUT /api/admin/bookings/[id]/zoom-link
 * 
 * Admin fallback for manually updating Zoom meeting details.
 * Delegates to updateZoomDetails from booking transitions.
 */
export const PUT = withRoleContext(
    Role.ADMIN,
    async (req: Request, { user }, { params }: { params: { id: string } }) => {
    const { id } = params;

    try {
        const body = await req.json();
        const result = zoomLinkSchema.safeParse(body);

        if (!result.success) {
            return Response.json({ error: 'validation_error', details: result.error.issues }, { status: 400 });
        }

        await updateZoomDetails(
            id,
            {
                zoomJoinUrl: result.data.zoomJoinUrl,
                zoomMeetingId: result.data.zoomMeetingId,
                candidateZoomJoinUrl: result.data.candidateZoomJoinUrl,
                professionalZoomJoinUrl: result.data.professionalZoomJoinUrl,
            },
            { userId: user.id, role: Role.ADMIN }
        );

        return Response.json({ success: true });
    } catch (error: any) {
        console.error('Error updating zoom link:', error);
        return Response.json({ error: error.message || 'internal_error' }, { status: 500 });
    }
});
