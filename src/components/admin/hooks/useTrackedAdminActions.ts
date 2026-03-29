'use client';

import { useRouter } from 'next/navigation';
import {
    resolveAdminDispute,
    updateAdminZoomLinks,
    type DisputeResolutionAction,
} from '@/components/admin/services/adminMutationApi';
import type { ActionToastOverride } from '@/components/ui/actions/executeTrackedAction';
import { executeTrackedAction } from '@/components/ui/actions/executeTrackedAction';
import { buildErrorToastCopy } from '@/components/ui/hooks/requestToastController';
import { useTrackedRequest } from '@/components/ui/providers/RequestToastProvider';

interface ResolveDisputeArgs {
    disputeId: string;
    action: DisputeResolutionAction;
    resolution: string;
    refundAmountCents?: number;
    toast?: ActionToastOverride<void>;
}

interface UpdateZoomLinksArgs {
    bookingId: string;
    zoomJoinUrl?: string;
    zoomMeetingId?: string;
    candidateZoomJoinUrl?: string;
    professionalZoomJoinUrl?: string;
    toast?: ActionToastOverride<void>;
}

export function useTrackedAdminActions() {
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const runtime = {
        runTrackedRequest,
        push: router.push,
        replace: router.replace,
        refresh: router.refresh,
    };

    const resolveDispute = async ({
        disputeId,
        action,
        resolution,
        refundAmountCents,
        toast,
    }: ResolveDisputeArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await resolveAdminDispute({
                    disputeId,
                    action,
                    resolution,
                    refundAmountCents,
                });
            },
            copy: {
                pending: {
                    title: 'Resolving dispute',
                    message: 'Submitting the dispute resolution decision.',
                },
                success: {
                    title: 'Dispute resolved',
                    message: action === 'dismiss'
                        ? 'The dispute has been dismissed.'
                        : action === 'full_refund'
                            ? 'A full refund has been recorded.'
                            : 'The partial refund has been recorded.',
                },
                error: (error) => buildErrorToastCopy(error, 'Dispute resolution failed'),
            },
            toast,
            postSuccess: { kind: 'refresh' },
        });

    const updateZoomLinks = async ({
        bookingId,
        zoomJoinUrl,
        zoomMeetingId,
        candidateZoomJoinUrl,
        professionalZoomJoinUrl,
        toast,
    }: UpdateZoomLinksArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await updateAdminZoomLinks({
                    bookingId,
                    zoomJoinUrl,
                    zoomMeetingId,
                    candidateZoomJoinUrl,
                    professionalZoomJoinUrl,
                });
            },
            copy: {
                pending: {
                    title: 'Updating Zoom links',
                    message: 'Saving the manual Zoom link override.',
                },
                success: {
                    title: 'Zoom links updated',
                    message: 'The booking now uses the new Zoom link settings.',
                },
                error: (error) => buildErrorToastCopy(error, 'Zoom link update failed'),
            },
            toast,
            postSuccess: { kind: 'refresh' },
        });

    return {
        resolveDispute,
        updateZoomLinks,
    };
}
