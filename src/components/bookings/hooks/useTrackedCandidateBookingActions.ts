'use client';

import { useRouter } from 'next/navigation';
import type { DisputeReason } from '@prisma/client';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import {
    acceptCandidateRescheduleProposal,
    cancelCandidateBooking,
    createCandidateBookingRequest,
    submitCandidateDispute,
    submitCandidateRescheduleRequest,
    submitCandidateReview,
} from '@/components/bookings/services/candidateBookingApi';
import type { ActionToastOverride } from '@/components/ui/actions/executeTrackedAction';
import { executeTrackedAction } from '@/components/ui/actions/executeTrackedAction';
import { buildErrorToastCopy } from '@/components/ui/hooks/requestToastController';
import { useTrackedRequest } from '@/components/ui/providers/RequestToastProvider';
import { appRoutes } from '@/lib/shared/routes';

interface CreateBookingRequestArgs {
    professionalId: string;
    availabilitySlots: SlotInterval[];
    timezone: string;
    toast?: ActionToastOverride<{ bookingId: string; clientSecret: string }>;
}

interface CancelBookingArgs {
    bookingId: string;
    toast?: ActionToastOverride<void>;
}

interface SubmitCandidateRescheduleArgs {
    bookingId: string;
    slots: SlotInterval[];
    reason?: string;
    timezone: string;
    toast?: ActionToastOverride<void>;
}

interface SubmitCandidateReviewArgs {
    bookingId: string;
    rating: number;
    text: string;
    timezone: string;
    toast?: ActionToastOverride<void>;
}

interface AcceptCandidateRescheduleProposalArgs {
    bookingId: string;
    startAt: string;
    endAt: string;
    toast?: ActionToastOverride<void>;
}

interface SubmitCandidateDisputeArgs {
    bookingId: string;
    reason: DisputeReason;
    description: string;
    toast?: ActionToastOverride<void>;
}

export function useTrackedCandidateBookingActions() {
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const runtime = {
        runTrackedRequest,
        push: router.push,
        replace: router.replace,
        refresh: router.refresh,
    };

    const createBookingRequest = async ({
        professionalId,
        availabilitySlots,
        timezone,
        toast,
    }: CreateBookingRequestArgs) =>
        executeTrackedAction(runtime, {
            action: () => createCandidateBookingRequest({ professionalId, availabilitySlots, timezone }),
            copy: {
                pending: {
                    title: 'Preparing booking request',
                    message: 'Submitting your availability and creating the payment step.',
                },
                success: {
                    title: 'Booking request ready',
                    message: 'Your availability is saved. Complete payment to finish the request.',
                },
                error: (error) => buildErrorToastCopy(error, 'Booking request failed', 'Failed to create booking request.'),
            },
            toast,
            postSuccess: { kind: 'none' },
        });

    const cancelBooking = async ({ bookingId, toast }: CancelBookingArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await cancelCandidateBooking({ bookingId });
            },
            copy: {
                pending: {
                    title: 'Cancelling booking',
                    message: 'Submitting your cancellation request.',
                },
                success: {
                    title: 'Booking cancelled',
                    message: 'Your booking has been cancelled.',
                },
                error: (error) => buildErrorToastCopy(error, 'Booking cancellation failed'),
            },
            toast,
            postSuccess: { kind: 'refresh' },
        });

    const submitRescheduleRequest = async ({
        bookingId,
        slots,
        reason,
        timezone,
        toast,
    }: SubmitCandidateRescheduleArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await submitCandidateRescheduleRequest({ bookingId, slots, reason, timezone });
            },
            copy: {
                pending: {
                    title: 'Submitting reschedule request',
                    message: 'Sending your new availability to the professional.',
                },
                success: {
                    title: 'Reschedule request submitted',
                    message: 'Your request is now waiting for the professional.',
                },
                error: (error) => buildErrorToastCopy(error, 'Reschedule request failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.candidate.bookingDetails(bookingId),
            },
        });

    const acceptRescheduleProposal = async ({
        bookingId,
        startAt,
        endAt,
        toast,
    }: AcceptCandidateRescheduleProposalArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await acceptCandidateRescheduleProposal({ bookingId, startAt, endAt });
            },
            copy: {
                pending: {
                    title: 'Accepting proposed time',
                    message: 'Finalizing the updated session time.',
                },
                success: {
                    title: 'Reschedule accepted',
                    message: 'Your booking has been updated to the new time.',
                },
                error: (error) => buildErrorToastCopy(error, 'Reschedule acceptance failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.candidate.bookingDetails(bookingId),
            },
        });

    const submitReview = async ({
        bookingId,
        rating,
        text,
        timezone,
        toast,
    }: SubmitCandidateReviewArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await submitCandidateReview({ bookingId, rating, text, timezone });
            },
            copy: {
                pending: {
                    title: 'Submitting review',
                    message: 'Saving your review and rating.',
                },
                success: {
                    title: 'Review submitted',
                    message: 'Your review is now attached to this booking.',
                },
                error: (error) => buildErrorToastCopy(error, 'Review submission failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.candidate.bookingDetails(bookingId),
            },
        });

    const submitDispute = async ({
        bookingId,
        reason,
        description,
        toast,
    }: SubmitCandidateDisputeArgs) =>
        executeTrackedAction(runtime, {
            action: async () => {
                await submitCandidateDispute({ bookingId, reason, description });
            },
            copy: {
                pending: {
                    title: 'Submitting dispute',
                    message: 'Sending your issue report for review.',
                },
                success: {
                    title: 'Dispute submitted',
                    message: 'Your report has been submitted and the booking details are updated.',
                },
                error: (error) => buildErrorToastCopy(error, 'Dispute submission failed'),
            },
            toast,
            postSuccess: {
                kind: 'push',
                href: appRoutes.candidate.bookingDetails(bookingId),
            },
        });

    return {
        createBookingRequest,
        cancelBooking,
        submitRescheduleRequest,
        acceptRescheduleProposal,
        submitReview,
        submitDispute,
    };
}
