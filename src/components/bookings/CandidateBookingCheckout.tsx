'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { appRoutes } from '@/lib/shared/routes';
import { BookingFlowShell, type BookingFlowStep } from '@/components/bookings/BookingFlowShell';
import { Button } from '@/components/ui/primitives/Button';
import { SurfaceCard } from '@/components/ui/composites/SurfaceCard/SurfaceCard';
import styles from './CandidateBookingCheckout.module.css';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CandidateBookingCheckoutProps {
    bookingId: string;
    clientSecret: string;
    priceCents: number;
    professionalLabel?: string;
    candidateTimezone?: string;
    professionalTimezone?: string | null;
}

export function CandidateBookingCheckout({
    bookingId,
    clientSecret,
    priceCents,
    professionalLabel,
    candidateTimezone,
    professionalTimezone,
}: CandidateBookingCheckoutProps) {
    const formattedPrice = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceCents / 100);
    const steps: BookingFlowStep[] = [
        {
            label: 'Share availability',
            description: 'Your preferred times are attached to this request.',
            status: 'complete',
        },
        {
            label: 'Payment authorization',
            description: 'Confirm secure payment details to send the request.',
            status: 'current',
        },
    ];

    return (
        <BookingFlowShell
            eyebrow="Payment authorization"
            title="Confirm payment details"
            description="Review the payment form below to finish submitting the booking request. Your scheduling details stay attached to the request."
            steps={steps}
            summaryTitle="Request summary"
            summaryDescription="A final check before you confirm payment."
            summary={
                <div className={styles.summaryList}>
                    {professionalLabel ? (
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Professional</span>
                            <span className={styles.summaryValue}>{professionalLabel}</span>
                        </div>
                    ) : null}
                    <div className={styles.summaryRow}>
                        <span className={styles.summaryLabel}>Session price</span>
                        <span className={styles.summaryValue}>{formattedPrice}</span>
                    </div>
                    {candidateTimezone ? (
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Your timezone</span>
                            <span className={styles.summaryValue}>{candidateTimezone}</span>
                        </div>
                    ) : null}
                    {professionalTimezone ? (
                        <div className={styles.summaryRow}>
                            <span className={styles.summaryLabel}>Professional timezone</span>
                            <span className={styles.summaryValue}>{professionalTimezone}</span>
                        </div>
                    ) : null}
                </div>
            }
            summaryFooter="After payment confirmation, the request moves to the professional for scheduling review."
        >
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
        </BookingFlowShell>
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
        <SurfaceCard as="form" onSubmit={handleSubmit} className={styles.card}>
            <div className={styles.heading}>
                <h3 className={styles.title}>Complete payment</h3>
                <p className={styles.description}>Enter payment details to finish submitting the booking request.</p>
            </div>
            <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />
            {message ? <div id="payment-message" className={styles.error}>{message}</div> : null}
            <Button
                type="submit"
                disabled={isLoading || !stripe || !elements}
                id="submit"
                variant="primary"
                className="w-full justify-center"
            >
                <span id="button-text">
                    {isLoading ? 'Processing...' : 'Pay now'}
                </span>
            </Button>
        </SurfaceCard>
    );
}
