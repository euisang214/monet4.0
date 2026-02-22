'use client';

import React, { useState } from 'react';
import { Booking } from '@prisma/client';
import { useRouter } from 'next/navigation';
import { getBookingActionVisibility } from '@/lib/shared/booking-actions';
import { appRoutes } from '@/lib/shared/routes';

interface BookingActionsProps {
    booking: Booking;
}

export function BookingActions({ booking }: BookingActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleCancel = async () => {
        if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
            return;
        }

        setIsLoading(true);
        setMessage(null);

        try {
            const res = await fetch(appRoutes.api.shared.bookingCancel(booking.id), {
                method: 'POST',
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to cancel booking');
            }

            router.refresh();
            setMessage('Booking cancelled successfully.');
        } catch (error: unknown) {
            if (error instanceof Error) {
                setMessage(`Error: ${error.message}`);
            } else {
                setMessage('Error: An unexpected error occurred');
            }
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
        getBookingActionVisibility(booking.status, !!joinUrl);

    return (
        <div className="flex flex-col gap-4 mt-6">
            {message && (
                <div className={`p-3 rounded text-sm ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {message}
                </div>
            )}

            <div className="flex flex-wrap gap-4">
                {showJoin && (
                    <button
                        onClick={handleJoin}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 font-medium whitespace-nowrap"
                    >
                        Join Zoom Call
                    </button>
                )}

                {showReschedule && (
                    <button
                        onClick={handleReschedule}
                        disabled={isLoading}
                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-50 font-medium whitespace-nowrap"
                    >
                        Reschedule
                    </button>
                )}

                {showCancel && (
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="flex-1 bg-white border border-red-200 text-red-600 py-2 px-4 rounded hover:bg-red-50 font-medium whitespace-nowrap"
                    >
                        {isLoading ? 'Processing...' : 'Cancel Booking'}
                    </button>
                )}

                {showDispute && (
                    <button
                        onClick={handleDispute}
                        className="flex-1 bg-white border border-orange-200 text-orange-600 py-2 px-4 rounded hover:bg-orange-50 font-medium whitespace-nowrap"
                    >
                        Report Issue
                    </button>
                )}

                {showReview && (
                    <button
                        onClick={handleReview}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 font-medium whitespace-nowrap"
                    >
                        Leave Review
                    </button>
                )}
            </div>
        </div>
    );
}
