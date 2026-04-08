'use client';

import { BookingStatus, RescheduleAwaitingParty } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button, buttonVariants } from '@/components/ui/primitives/Button';
import { appRoutes } from '@/lib/shared/routes';
import { getBookingActionVisibility } from '@/lib/shared/booking-actions';

interface CandidateHistoryActionsProps {
    bookingId: string;
    status: BookingStatus;
    joinUrl: string | null;
    rescheduleAwaitingParty?: RescheduleAwaitingParty | null;
    hasFeedback?: boolean;
}

export function CandidateHistoryActions({
    bookingId,
    status,
    joinUrl,
    rescheduleAwaitingParty,
    hasFeedback = false,
}: CandidateHistoryActionsProps) {
    const router = useRouter();
    const { cancelBooking } = useTrackedCandidateBookingActions();
    const [isCancelling, setIsCancelling] = useState(false);

    const { showJoin, showReschedule, showCancel, showDispute, showReview } = getBookingActionVisibility(
        status,
        Boolean(joinUrl),
        rescheduleAwaitingParty
    );

    const handleJoin = () => {
        if (!joinUrl) {
            return;
        }

        window.open(joinUrl, '_blank', 'noopener,noreferrer');
    };

    const handleCancel = async () => {
        const confirmed = window.confirm('Are you sure you want to cancel this booking?');
        if (!confirmed) {
            return;
        }

        setIsCancelling(true);

        try {
            await cancelBooking({ bookingId });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="mt-4 space-y-2">
            <div className="flex gap-2 flex-wrap">
                <Link
                    href={appRoutes.candidate.bookingDetails(bookingId)}
                    className={buttonVariants({ variant: 'primary', size: 'sm' })}
                >
                    View Booking
                </Link>

                {showJoin ? (
                    <Button
                        type="button"
                        onClick={handleJoin}
                        variant="secondary"
                        size="sm"
                    >
                        Join Zoom Call
                    </Button>
                ) : null}

                {showReschedule ? (
                    <Button
                        type="button"
                        onClick={() => router.push(appRoutes.candidate.bookingReschedule(bookingId))}
                        variant="secondary"
                        size="sm"
                    >
                        Reschedule
                    </Button>
                ) : null}

                {showCancel ? (
                    <Button
                        type="button"
                        onClick={handleCancel}
                        disabled={isCancelling}
                        variant="danger"
                        size="sm"
                    >
                        {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </Button>
                ) : null}

                {showDispute ? (
                    <Button
                        type="button"
                        onClick={() => router.push(appRoutes.candidate.bookingDispute(bookingId))}
                        variant="secondary"
                        size="sm"
                    >
                        Report Issue
                    </Button>
                ) : null}

                {showReview ? (
                    <Button
                        type="button"
                        onClick={() => router.push(appRoutes.candidate.bookingReview(bookingId))}
                        variant="primary"
                        size="sm"
                    >
                        Leave Review
                    </Button>
                ) : null}
            </div>

            {status === BookingStatus.completed ? (
                <p className="text-xs text-gray-500">
                    {hasFeedback
                        ? 'Feedback is available on the booking details page.'
                        : 'Feedback is not available yet for this completed booking.'}
                </p>
            ) : null}

        </div>
    );
}
