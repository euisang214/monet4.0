'use client';

import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';

// Initialize Stripe outside component
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface BookingRequestFormProps {
    professionalId: string;
    priceCents: number;
    candidateId: string;
}

export function BookingRequestForm({ professionalId, priceCents, candidateId }: BookingRequestFormProps) {
    const [weeks, setWeeks] = useState(1);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [bookingId, setBookingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleCreateRequest = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/candidate/bookings/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ professionalId, weeks }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to create booking request');
            }

            setClientSecret(data.data.clientSecret);
            setBookingId(data.data.bookingId);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const appearance = {
        theme: 'stripe' as const,
    };

    const options = {
        clientSecret: clientSecret || '',
        appearance,
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
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Sessions (Weeks)
                </label>
                <select
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value))}
                    className="w-full border-gray-300 rounded-md shadow-sm p-2"
                    disabled={isLoading}
                >
                    {[1, 2, 3, 4, 8, 12].map((w) => (
                        <option key={w} value={w}>
                            {w} {w === 1 ? 'Week' : 'Weeks'}
                        </option>
                    ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                    One 30-min session per week.
                </p>
            </div>

            <div className="flex justify-between items-center mb-6 pt-4 border-t">
                <span className="font-semibold">Total:</span>
                <span className="text-xl font-bold">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((priceCents * weeks) / 100)}
                </span>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleCreateRequest}
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
                {isLoading ? 'Processing...' : 'Proceed to Payment'}
            </button>
        </div>
    );
}

function CheckoutForm({ bookingId }: { bookingId: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL where the user is redirected after the payment.
                // We'll redirect to the dashboard or a success page.
                // For now, redirect to dashboard with success query param.
                return_url: `${window.location.origin}/candidate/dashboard?payment_success=true&booking_id=${bookingId}`,
            },
        });

        if (error) {
            if (error.type === "card_error" || error.type === "validation_error") {
                setMessage(error.message || "An unexpected error occurred.");
            } else {
                setMessage("An unexpected error occurred.");
            }
        }

        setIsLoading(false);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium mb-4">Complete Payment</h3>
            <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
            {message && <div id="payment-message" className="mt-4 text-red-600 text-sm">{message}</div>}
            <button
                disabled={isLoading || !stripe || !elements}
                id="submit"
                className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
                <span id="button-text">
                    {isLoading ? "Processing..." : "Pay now"}
                </span>
            </button>
        </form>
    );
}
