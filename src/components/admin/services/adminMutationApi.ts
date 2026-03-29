import { appRoutes } from '@/lib/shared/routes';

interface ApiErrorResponse {
    error?: string;
}

export type DisputeResolutionAction = 'dismiss' | 'full_refund' | 'partial_refund';

interface ResolveDisputeArgs {
    disputeId: string;
    action: DisputeResolutionAction;
    resolution: string;
    refundAmountCents?: number;
}

interface UpdateZoomLinksArgs {
    bookingId: string;
    zoomJoinUrl?: string;
    zoomMeetingId?: string;
    candidateZoomJoinUrl?: string;
    professionalZoomJoinUrl?: string;
}

export async function resolveAdminDispute({
    disputeId,
    action,
    resolution,
    refundAmountCents,
}: ResolveDisputeArgs) {
    const response = await fetch(appRoutes.api.admin.disputeResolve(disputeId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action,
            resolution,
            refundAmountCents,
        }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to resolve dispute');
}

export async function updateAdminZoomLinks({
    bookingId,
    zoomJoinUrl,
    zoomMeetingId,
    candidateZoomJoinUrl,
    professionalZoomJoinUrl,
}: UpdateZoomLinksArgs) {
    const response = await fetch(appRoutes.api.admin.bookingZoomLink(bookingId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            zoomJoinUrl,
            zoomMeetingId,
            candidateZoomJoinUrl,
            professionalZoomJoinUrl,
        }),
    });

    if (response.ok) {
        return;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorResponse | null;
    throw new Error(payload?.error || 'Failed to update');
}
