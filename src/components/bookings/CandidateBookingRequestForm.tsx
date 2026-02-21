'use client';

import React, { useCallback, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useCandidateBookingRequest } from '@/components/bookings/hooks/useCandidateBookingRequest';
import { appRoutes } from '@/lib/shared/routes';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CandidateBookingRequestFormProps {
    professionalId: string;
    priceCents: number;
    professionalTimezone?: string | null;
    candidateTimezone?: string;
}

export function CandidateBookingRequestForm({
    professionalId,
    priceCents,
    professionalTimezone,
    candidateTimezone,
}: CandidateBookingRequestFormProps) {
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>([]);
    const resolvedCandidateTimezone = React.useMemo(
        () => candidateTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [candidateTimezone]
    );

    const { clientSecret, bookingId, isSubmitting, error, submitRequest } =
        useCandidateBookingRequest(professionalId, resolvedCandidateTimezone);

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots: slots }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setAvailabilitySlots(slots);
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
            <CandidateAvailabilityPanel
                calendarTimezone={resolvedCandidateTimezone}
                professionalTimezone={professionalTimezone}
                onSelectionChange={handleSlotSelectionChange}
                selectedCountLabel="Selected Candidate Slots"
                className="mb-4"
            />

            <div className="flex justify-between items-center mb-6 pt-4 border-t">
                <span className="font-semibold">Session Price:</span>
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
