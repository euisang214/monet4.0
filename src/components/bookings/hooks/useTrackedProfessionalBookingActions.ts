'use client';

import { useRouter } from 'next/navigation';
import {
    cancelProfessionalUpcomingBooking,
    confirmProfessionalBooking,
    rejectProfessionalRequest,
    submitProfessionalFeedback,
} from '@/components/bookings/services/professionalBookingApi';
import {
    confirmProfessionalReschedule,
    rejectProfessionalReschedule,
    submitProfessionalRescheduleProposal,
} from '@/components/bookings/services/professionalRescheduleApi';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import type { ActionToastOverride } from '@/components/ui/actions/executeTrackedAction';
import { executeTrackedAction } from '@/components/ui/actions/executeTrackedAction';
import { buildErrorToastCopy } from '@/components/ui/hooks/requestToastController';
import { useTrackedRequest } from '@/components/ui/providers/RequestToastProvider';
import { appRoutes } from '@/lib/shared/routes';

interface BookingActionArgs {
    bookingId: string;
}

interface ConfirmBookingArgs extends BookingActionArgs {
    startAt: string;
    toast?: ActionToastOverride<void>;
}

interface RejectRequestArgs extends BookingActionArgs {
    isReschedule: boolean;
    toast?: ActionToastOverride<void>;
}

interface SubmitFeedbackArgs extends BookingActionArgs {
    text: string;
    actions: string[];
    contentRating: number;
    deliveryRating: number;
    valueRating: number;
    toast?: ActionToastOverride<void>;
}

interface ConfirmRescheduleArgs extends BookingActionArgs {
    startAt: string;
    toast?: ActionToastOverride<void>;
}

interface SubmitRescheduleProposalArgs extends BookingActionArgs {
    slots: SlotInterval[];
    reason?: string;
    toast?: ActionToastOverride<void>;
}

interface SimpleActionArgs extends BookingActionArgs {
    toast?: ActionToastOverride<void>;
}

export function useTrackedProfessionalBookingActions() {
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const runtime = {
        runTrackedRequest,
        push: router.push,
        replace: router.replace,
        refresh: router.refresh,
    };

    const confirmBooking = async ({ bookingId, startAt, toast }: ConfirmBookingArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await confirmProfessionalBooking({ bookingId, startAt });
            },
            copy: {
                pending: {
                    title: 'Confirming booking',
                    message: 'Scheduling this request and updating the dashboard.',
                },
                success: {
                    title: 'Booking confirmed',
                    message: 'Booking confirmed and scheduled.',
                },
                error: (error) => buildErrorToastCopy(error, 'Booking confirmation failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.professional.dashboard,
            },
        });

    const cancelUpcomingBooking = async ({ bookingId, toast }: SimpleActionArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await cancelProfessionalUpcomingBooking({ bookingId });
            },
            copy: {
                pending: {
                    title: 'Cancelling booking',
                    message: 'Submitting your cancellation request.',
                },
                success: {
                    title: 'Booking cancelled',
                    message: 'The booking has been cancelled.',
                },
                error: (error) => buildErrorToastCopy(error, 'Booking cancellation failed'),
            },
            toast,
            postSuccess: { kind: 'refresh' },
        });

    const requestReschedule = async ({ bookingId }: SimpleActionArgs) => {
        router.push(appRoutes.professional.requestReschedule(bookingId));
    };

    const confirmReschedule = async ({ bookingId, startAt, toast }: ConfirmRescheduleArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await confirmProfessionalReschedule(bookingId, startAt);
            },
            copy: {
                pending: {
                    title: 'Confirming reschedule',
                    message: 'Scheduling the new meeting time.',
                },
                success: {
                    title: 'Reschedule confirmed',
                    message: 'The updated time has been scheduled.',
                },
                error: (error) => buildErrorToastCopy(error, 'Reschedule confirmation failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.professional.dashboard,
            },
        });

    const submitRescheduleProposal = async ({ bookingId, slots, reason, toast }: SubmitRescheduleProposalArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await submitProfessionalRescheduleProposal(bookingId, slots, reason);
            },
            copy: {
                pending: {
                    title: 'Sending proposed times',
                    message: 'Sharing your proposed times with the candidate.',
                },
                success: {
                    title: 'Proposal sent',
                    message: 'The candidate can now accept or counter your proposed times.',
                },
                error: (error) => buildErrorToastCopy(error, 'Proposal submission failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.professional.dashboard,
            },
        });

    const rejectReschedule = async ({ bookingId, toast }: SimpleActionArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await rejectProfessionalReschedule(bookingId);
            },
            copy: {
                pending: {
                    title: 'Rejecting reschedule',
                    message: 'Closing this reschedule request.',
                },
                success: {
                    title: 'Reschedule rejected',
                    message: 'The candidate can submit a different request if needed.',
                },
                error: (error) => buildErrorToastCopy(error, 'Reschedule rejection failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.professional.dashboard,
            },
        });

    const rejectRequest = async ({ bookingId, isReschedule, toast }: RejectRequestArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await rejectProfessionalRequest({ bookingId, isReschedule });
            },
            copy: {
                pending: {
                    title: isReschedule ? 'Rejecting reschedule' : 'Rejecting request',
                    message: isReschedule
                        ? 'Closing this reschedule request.'
                        : 'Declining this candidate booking request.',
                },
                success: {
                    title: isReschedule ? 'Reschedule rejected' : 'Request rejected',
                    message: isReschedule
                        ? 'The reschedule request has been rejected.'
                        : 'The booking request has been declined.',
                },
                error: (error) => buildErrorToastCopy(error, 'Request update failed'),
            },
            toast,
            postSuccess: { kind: 'refresh' },
        });

    const submitFeedback = async ({
        bookingId,
        text,
        actions,
        contentRating,
        deliveryRating,
        valueRating,
        toast,
    }: SubmitFeedbackArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await submitProfessionalFeedback({
                    bookingId,
                    text,
                    actions,
                    contentRating,
                    deliveryRating,
                    valueRating,
                });
            },
            copy: {
                pending: {
                    title: 'Submitting feedback',
                    message: 'Sending your feedback for QC review.',
                },
                success: {
                    title: 'Feedback submitted',
                    message: 'Feedback submitted. QC review is in progress.',
                },
                error: (error) => buildErrorToastCopy(error, 'Feedback submission failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.professional.dashboard,
            },
        });

    return {
        confirmBooking,
        cancelUpcomingBooking,
        requestReschedule,
        confirmReschedule,
        submitRescheduleProposal,
        rejectReschedule,
        rejectRequest,
        submitFeedback,
    };
}
