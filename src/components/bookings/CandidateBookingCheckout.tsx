'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { appRoutes } from '@/lib/shared/routes';
import { Button } from '@/components/ui/primitives/Button';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CandidateBookingCheckoutProps {
    bookingId: string;
    clientSecret: string;
}

export function CandidateBookingCheckout({ bookingId, clientSecret }: CandidateBookingCheckoutProps) {
    return (
        <Elements
            options={{
                clientSecret,
                appearance: {
                    theme: 'stripe',
                },
            }}
            stripe={stripePromise}
        >
            <CheckoutForm bookingId={bookingId} />
        </Elements>
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
