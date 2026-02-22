'use client';

import { BookingStatus } from '@prisma/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { appRoutes } from '@/lib/shared/routes';
import { getBookingActionVisibility } from '@/lib/shared/booking-actions';

interface CandidateHistoryActionsProps {
    bookingId: string;
    status: BookingStatus;
    joinUrl: string | null;
    hasFeedback?: boolean;
}

export function CandidateHistoryActions({
    bookingId,
    status,
    joinUrl,
    hasFeedback = false,
}: CandidateHistoryActionsProps) {
    const router = useRouter();
    const [isCancelling, setIsCancelling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { showJoin, showReschedule, showCancel, showDispute, showReview } = getBookingActionVisibility(status, Boolean(joinUrl));

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
        setError(null);

        try {
            const response = await fetch(appRoutes.api.shared.bookingCancel(bookingId), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.error || 'Failed to cancel booking.');
            }

            router.refresh();
        } catch (cancelError: unknown) {
            if (cancelError instanceof Error) {
                setError(cancelError.message);
            } else {
                setError('Failed to cancel booking.');
            }
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div className="mt-4 space-y-2">
            <div className="flex gap-2 flex-wrap">
                <Link
                    href={appRoutes.candidate.bookingDetails(bookingId)}
                    className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm"
                >
                    View Booking
                </Link>

                {showJoin ? (
                    <button
                        type="button"
                        onClick={handleJoin}
                        className="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm"
                    >
                        Join Zoom Call
                    </button>
                ) : null}

                {showReschedule ? (
                    <button
                        type="button"
                        onClick={() => router.push(appRoutes.candidate.bookingReschedule(bookingId))}
                        className="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm"
                    >
                        Reschedule
                    </button>
                ) : null}

                {showCancel ? (
                    <button
                        type="button"
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="btn bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-sm disabled:opacity-60"
                    >
                        {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                ) : null}

                {showDispute ? (
                    <button
                        type="button"
                        onClick={() => router.push(appRoutes.candidate.bookingDispute(bookingId))}
                        className="btn border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 text-sm"
                    >
                        Report Issue
                    </button>
                ) : null}

                {showReview ? (
                    <button
                        type="button"
                        onClick={() => router.push(appRoutes.candidate.bookingReview(bookingId))}
                        className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm"
                    >
                        Leave Review
                    </button>
                ) : null}
            </div>

            {status === BookingStatus.completed ? (
                <p className="text-xs text-gray-500">
                    {hasFeedback
                        ? 'Feedback is available on the booking details page.'
                        : 'Feedback is not available yet for this completed booking.'}
                </p>
            ) : null}

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
    );
}
