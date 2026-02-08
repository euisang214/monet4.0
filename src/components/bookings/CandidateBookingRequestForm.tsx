'use client';

import React, { useCallback, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CandidateWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useCandidateBookingRequest } from '@/components/bookings/hooks/useCandidateBookingRequest';
import { useCandidateGoogleBusy } from '@/components/bookings/hooks/useCandidateGoogleBusy';
import { appRoutes } from '@/lib/shared/routes';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CandidateBookingRequestFormProps {
    professionalId: string;
    priceCents: number;
}

export function CandidateBookingRequestForm({ professionalId, priceCents }: CandidateBookingRequestFormProps) {
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>([]);
    const [selectedSlotCount, setSelectedSlotCount] = useState(0);

    const { googleBusyIntervals, isLoadingBusy, busyLoadError, lastBusyRefreshAt, refreshGoogleBusy } =
        useCandidateGoogleBusy();

    const { clientSecret, bookingId, isSubmitting, error, submitRequest } =
        useCandidateBookingRequest(professionalId);

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots, selectedCount }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
            setSelectedSlotCount(selectedCount);
        },
        []
    );

    const handleCreateRequest = async () => {
        await submitRequest(availabilitySlots);
    };

    const options = {
        clientSecret: clientSecret || '',
        appearance: {
            theme: 'stripe' as const,
        },
    };

    if (clientSecret && bookingId) {
        return (
            <Elements options={options} stripe={stripePromise}>
                <CheckoutForm bookingId={bookingId} />
            </Elements>
        );
    }

    return (
        <div className="bg-gray-50 p-6 rounded-lg border">
            <div className="mb-6">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void refreshGoogleBusy()}
                        disabled={isLoadingBusy}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                        {isLoadingBusy ? 'Refreshing calendar...' : 'Refresh Google Calendar'}
                    </button>
                    {lastBusyRefreshAt && (
                        <span className="text-xs text-gray-500">
                            Last synced {lastBusyRefreshAt.toLocaleTimeString()}
                        </span>
                    )}
                </div>
                {busyLoadError && (
                    <div className="mb-3 p-3 bg-yellow-50 text-yellow-700 rounded text-sm">
                        {busyLoadError}
                    </div>
                )}

                <CandidateWeeklySlotPicker
                    googleBusyIntervals={googleBusyIntervals}
                    onChange={handleSlotSelectionChange}
                />
            </div>

            <p className="text-sm text-gray-500 mb-4">
                Selected candidate slots: <span className="font-medium">{selectedSlotCount}</span>
            </p>

            <div className="flex justify-between items-center mb-6 pt-4 border-t">
                <span className="font-semibold">Session price:</span>
                <span className="text-xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceCents / 100)}
                </span>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleCreateRequest}
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
                {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
            </button>
        </div>
    );
}

function CheckoutForm({ bookingId }: { bookingId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}${appRoutes.candidate.chats}?payment_success=true&booking_id=${bookingId}`,
            },
        });

        if (error) {
            if (error.type === 'card_error' || error.type === 'validation_error') {
                setMessage(error.message || 'An unexpected error occurred.');
            } else {
                setMessage('An unexpected error occurred.');
            }
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium mb-4">Complete Payment</h3>
            <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />
            {message && <div id="payment-message" className="mt-4 text-red-600 text-sm">{message}</div>}
            <button
                disabled={isLoading || !stripe || !elements}
                id="submit"
                className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
                <span id="button-text">
                    {isLoading ? 'Processing...' : 'Pay now'}
                </span>
            </button>
        </form>
    );
}
