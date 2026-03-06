'use client';

import React, { useCallback, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { useCandidateBookingRequest } from '@/components/bookings/hooks/useCandidateBookingRequest';
import { appRoutes } from '@/lib/shared/routes';
import { Button } from '@/components/ui/primitives/Button';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CandidateBookingRequestFormProps {
    professionalId: string;
    priceCents: number;
    professionalTimezone?: string | null;
    candidateTimezone?: string;
    isGoogleCalendarConnected: boolean;
    initialAvailabilitySlots?: SlotInterval[];
}

export function CandidateBookingRequestForm({
    professionalId,
    priceCents,
    professionalTimezone,
    candidateTimezone,
    isGoogleCalendarConnected,
    initialAvailabilitySlots = [],
}: CandidateBookingRequestFormProps) {
    const [availabilitySlots, setAvailabilitySlots] = useState<SlotInterval[]>(() => initialAvailabilitySlots);
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
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <CandidateAvailabilityPanel
                calendarTimezone={resolvedCandidateTimezone}
                isGoogleCalendarConnected={isGoogleCalendarConnected}
                professionalTimezone={professionalTimezone}
                initialSelectedSlots={initialAvailabilitySlots}
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
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            )}

            <Button
                onClick={handleCreateRequest}
                disabled={isSubmitting}
                variant="primary"
                className="w-full justify-center"
            >
                {isSubmitting ? 'Processing...' : 'Proceed to Payment'}
            </Button>
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
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-medium mb-4">Complete Payment</h3>
            <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />
            {message && <div id="payment-message" className="mt-4 text-red-600 text-sm">{message}</div>}
            <Button
                type="submit"
                disabled={isLoading || !stripe || !elements}
                id="submit"
                variant="primary"
                className="mt-6 w-full justify-center"
            >
                <span id="button-text">
                    {isLoading ? 'Processing...' : 'Pay now'}
                </span>
            </Button>
        </form>
    );
}
