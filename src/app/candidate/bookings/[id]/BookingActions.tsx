'use client';

import React, { useState } from 'react';
import { Booking } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';
import { getBookingActionVisibility } from '@/lib/shared/booking-actions';
import { appRoutes } from '@/lib/shared/routes';

interface BookingActionsProps {
    booking: Booking;
}

export function BookingActions({ booking }: BookingActionsProps) {
    const router = useRouter();
    const { cancelBooking } = useTrackedCandidateBookingActions();
    const [isLoading, setIsLoading] = useState(false);

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
            return;
        }

        setIsLoading(true);

        try {
            await cancelBooking({ bookingId: booking.id });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsLoading(false);
        }
    };

    const handleReschedule = () => {
        router.push(appRoutes.candidate.bookingReschedule(booking.id));
    };

    const joinUrl = booking.candidateZoomJoinUrl || booking.zoomJoinUrl;

    const handleJoin = () => {
        if (joinUrl) {
            window.open(joinUrl, '_blank');
        }
    };

    const handleDispute = () => {
        router.push(appRoutes.candidate.bookingDispute(booking.id));
    };

    const handleReview = () => {
        router.push(appRoutes.candidate.bookingReview(booking.id));
    };

    // Use centralized visibility logic
    const { showJoin, showReschedule, showCancel, showDispute, showReview } =
        getBookingActionVisibility(booking.status, !!joinUrl, booking.rescheduleAwaitingParty);

    return (
        <div className="flex flex-col gap-4 mt-6">
            <div className="flex flex-wrap gap-4">
                {showJoin && (
                    <Button
                        type="button"
                        onClick={handleJoin}
                        className="flex-1 whitespace-nowrap"
                        variant="primary"
                    >
                        Join Zoom Call
                    </Button>
                )}

                {showReschedule && (
                    <Button
                        type="button"
                        onClick={handleReschedule}
                        disabled={isLoading}
                        className="flex-1 whitespace-nowrap"
                        variant="secondary"
                    >
                        Reschedule
                    </Button>
                )}

                {showCancel && (
                    <Button
                        type="button"
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="flex-1 whitespace-nowrap"
                        variant="danger"
                    >
                        {isLoading ? 'Processing...' : 'Cancel Booking'}
                    </Button>
                )}

                {showDispute && (
                    <Button
                        type="button"
                        onClick={handleDispute}
                        className="flex-1 whitespace-nowrap"
                        variant="secondary"
                    >
                        Report Issue
                    </Button>
                )}

                {showReview && (
                    <Button
                        type="button"
                        onClick={handleReview}
                        className="flex-1 whitespace-nowrap"
                        variant="primary"
                    >
                        Leave Review
                    </Button>
                )}
            </div>
        </div>
    );
}
