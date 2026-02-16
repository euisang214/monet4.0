import { prisma } from '@/lib/core/db';
import { validateFeedbackRequirements } from '@/lib/shared/qc';
import { ClaudeService } from '@/lib/integrations/claude';
import { paymentsQueue, qcQueue, notificationsQueue } from '@/lib/queues';
import { PayoutStatus, QCStatus, BookingStatus } from '@prisma/client';
import { stripe, refundPayment, createTransfer } from '@/lib/integrations/stripe';

function toTitleCase(value: string) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatReviewerName(email: string | null | undefined) {
    if (!email) return 'Anonymous Reviewer';

    const localPart = email.split('@')[0];
    if (!localPart) return 'Anonymous Reviewer';

    const normalized = localPart
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[._-]+/g, ' ')
        .replace(/\d+/g, ' ')
        .trim();

    const nameParts = normalized
        .split(/\s+/)
        .map((part) => part.replace(/[^a-zA-Z]/g, ''))
        .filter(Boolean);

    if (nameParts.length === 0) return 'Anonymous Reviewer';

    const firstName = toTitleCase(nameParts[0]);
    const lastPart = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0];
    const lastInitial = lastPart.charAt(0).toUpperCase();

    if (!firstName || !lastInitial) return 'Anonymous Reviewer';

    return `${firstName} ${lastInitial}`;
}

export function estimateStripeFeeCents(amountGross: number): number {
    return Math.ceil(amountGross * 0.029 + 30);
}

export const QCService = {
    /**
     * Processes a QC job for a given booking.
     * 1. Validates feedback requirements (length, action items).
     * 2. Mocks LLM content check.
     * 3. Updates CallFeedback status.
     * 4. If passed, creates a generic Payout record and enqueues payment processing.
     */
    async processQCJob(bookingId: string) {
        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                feedback: true,
                professional: true,
                payment: true, // Need payment info to calculate net amount? Or priceCents?
            },
        });

        if (!booking) {
            throw new Error(`Booking ${bookingId} not found`);
        }

        if (!booking.feedback) {
            throw new Error(`No feedback found for booking ${bookingId}`);
        }

        const { text, actions } = booking.feedback;

        // 1. Shared Validation (Rules) - Fast fail
        const ruleCheck = validateFeedbackRequirements(text, actions);

        if (!ruleCheck.passed) {
            console.log(`[QC] Booking ${bookingId} failed fast-rule check: ${ruleCheck.reasons.join(', ')}`);
            await notificationsQueue.add('send-email', {
                type: 'feedback_revise',
                bookingId,
                reasons: ruleCheck.reasons
            });

            // Update status to revise immediately
            await prisma.callFeedback.update({
                where: { bookingId },
                data: { qcStatus: QCStatus.revise }
            });

            return { processed: true, status: QCStatus.revise };
        }

        // 2. LLM Check (Content Quality) via Claude
        let finalStatus: QCStatus = QCStatus.passed;

        try {
            const claudeResult = await ClaudeService.validateFeedback(text, actions);

            if (!claudeResult.passed) {
                finalStatus = QCStatus.revise;
                console.log(`[QC] Booking ${bookingId} failed Claude check: ${claudeResult.reasons.join(', ')}`);

                await notificationsQueue.add('send-email', {
                    type: 'feedback_revise',
                    bookingId,
                    reasons: claudeResult.reasons
                });

                // Schedule Timeout & Nudges
                // 1. Timeout Job (7 days)
                await qcQueue.add('qc-timeout', { bookingId }, {
                    delay: 7 * 24 * 60 * 60 * 1000,
                    jobId: `qc-timeout-${bookingId}` // Idempotent
                });

                // 2. Nudge 1 (24h)
                await notificationsQueue.add('send-email', {
                    type: 'feedback_revise_nudge',
                    bookingId,
                    hoursRemaining: 144 // 6 days
                }, {
                    delay: 24 * 60 * 60 * 1000,
                    jobId: `qc-nudge-1-${bookingId}`
                });

                // 3. Nudge 2 (48h)
                await notificationsQueue.add('send-email', {
                    type: 'feedback_revise_nudge',
                    bookingId,
                    hoursRemaining: 120 // 5 days
                }, {
                    delay: 48 * 60 * 60 * 1000,
                    jobId: `qc-nudge-2-${bookingId}`
                });
            }
        } catch (error) {
            console.error(`[QC] Booking ${bookingId} API error`, error);
            // Re-throw to fail the job and trigger BullMQ retry backoff
            throw error;
        }

        // 3. Update Feedback Status
        await prisma.callFeedback.update({
            where: { bookingId },
            data: {
                qcStatus: finalStatus,
            }
        });

        // 4. If Passed -> Create Payout & Trigger Payment
        if (finalStatus === QCStatus.passed) {
            console.log(`[QC] Booking ${bookingId} PASSED. customized payout flow starting...`);

            // Calculate Net Amount (80% of price)
            // Platform Fee is 20%.
            const priceCents = booking.priceCents || 0;
            const amountNet = Math.floor(priceCents * 0.8);

            if (!booking.professional.stripeAccountId) {
                // Should we fail? Or block payout?
                // For now, let's assume pro has account or we create blocked payout.
                console.warn(`[QC] Pro ${booking.professionalId} has no Stripe Account ID.`);
            }

            // Create Payout Record (Idempotent upsert potentially? Or just create if not exists?)
            // schema.prisma says bookingId is @unique for Payout.
            // So we can use upsert to be safe/idempotent.
            const payout = await prisma.payout.upsert({
                where: { bookingId },
                create: {
                    bookingId,
                    proStripeAccountId: booking.professional.stripeAccountId || 'MISSING_ACCOUNT',
                    amountNet,
                    status: booking.professional.stripeAccountId ? PayoutStatus.pending : PayoutStatus.blocked,
                    reason: booking.professional.stripeAccountId ? null : 'Missing Stripe Account',
                },
                update: {}, // No-op if exists
            });

            if (payout.status === PayoutStatus.pending) {
                // Enqueue Payment Job
                await paymentsQueue.add('process-payout', { bookingId });
                console.log(`[QC] Enqueued payout job for booking ${bookingId}`);

                // Notify Professional
                await notificationsQueue.add('send-email', {
                    type: 'payout_initiated',
                    bookingId
                });
            }
        }

        return { processed: true, status: finalStatus };
    },

    /**
     * Fetches reviews for a professional.
     */
    async getProfessionalReviews(professionalId: string) {
        // Query ProfessionalRating via Booking generic relation? 
        // ProfessionalRating key is bookingId. 
        // We need reviews WHERE booking.professionalId = professionalId.
        const reviews = await prisma.professionalRating.findMany({
            where: {
                booking: {
                    professionalId: professionalId
                }
            },
            orderBy: {
                submittedAt: 'desc'
            },
            select: {
                bookingId: true,
                rating: true,
                text: true,
                submittedAt: true,
                booking: {
                    select: {
                        candidate: {
                            select: {
                                email: true,
                            },
                        },
                    },
                },
            }
        });

        return reviews.map((review) => ({
            bookingId: review.bookingId,
            rating: review.rating,
            text: review.text,
            submittedAt: review.submittedAt,
            reviewerName: formatReviewerName(review.booking?.candidate?.email),
        }));
    },

    /**
     * Handles the 7-day timeout for stalled QC revisions.
     * Executes 50/50 split of net value between candidate and professional.
     */
    async handleTimeout(bookingId: string) {
        console.log(`[QC] Handling timeout for booking ${bookingId}`);

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                payment: true,
                professional: true
            }
        });

        if (!booking) throw new Error('Booking not found');
        if (!booking.payment) throw new Error('Payment not found');

        // Idempotency / State Check
        // If status is passed or completed, do nothing.
        // We only act if qcStatus is still revise (or we check CallFeedback directly).
        // But checking booking.status is safer if we mark it completed.
        // If booking is already completed, skip.
        if (booking.status === BookingStatus.completed || booking.status === BookingStatus.refunded) {
            console.log(`[QC] Timeout skipped - booking ${bookingId} is already ${booking.status}`);
            return;
        }

        const feedback = await prisma.callFeedback.findUnique({ where: { bookingId } });
        if (feedback?.qcStatus === QCStatus.passed) {
            console.log(`[QC] Timeout skipped - QC passed meanwhile.`);
            return;
        }

        // Calculate Values
        // 1. Get Fee from Stripe
        let stripeFeeCents = 0;
        let sourceTransactionId: string | undefined;
        try {
            // We need the Latest Charge or PaymentIntent's latest_charge
            // Payment stores paymentIntentId.
            const pi = await stripe.paymentIntents.retrieve(booking.payment.stripePaymentIntentId, {
                expand: ['latest_charge.balance_transaction']
            });

            if (pi.latest_charge && typeof pi.latest_charge !== 'string') {
                sourceTransactionId = pi.latest_charge.id;

                const txn = pi.latest_charge.balance_transaction;
                if (txn && typeof txn !== 'string') {
                    stripeFeeCents = txn.fee;
                } else {
                    console.warn(`[QC] Could not retrieve balance transaction for PI ${booking.payment.stripePaymentIntentId}. Using estimate (2.9% + 30c).`);
                    stripeFeeCents = estimateStripeFeeCents(booking.payment.amountGross);
                }
            } else {
                console.warn(`[QC] Could not retrieve latest charge for PI ${booking.payment.stripePaymentIntentId}. Using estimate (2.9% + 30c).`);
                stripeFeeCents = estimateStripeFeeCents(booking.payment.amountGross);
            }
        } catch (e) {
            console.error(`[QC] Error fetching Stripe fee`, e);
            // Fallback to safe estimate or 0? 
            // Better to estimate to avoid over-refunding? 
            stripeFeeCents = estimateStripeFeeCents(booking.payment.amountGross);
        }

        const netAmount = booking.payment.amountGross - stripeFeeCents;
        const share = Math.floor(netAmount / 2);

        console.log(`[QC] Timeout Calculation: Gross=${booking.payment.amountGross}, Fee=${stripeFeeCents}, Net=${netAmount}, Share=${share}`);

        if (share > 0 && booking.professional.stripeAccountId && !sourceTransactionId) {
            throw new Error(
                `Cannot create transfer for booking ${bookingId}: PaymentIntent ${booking.payment.stripePaymentIntentId} has no charge`
            );
        }

        // Execute Refund (Candidate Share)
        if (share > 0) {
            await refundPayment(booking.payment.stripePaymentIntentId, share, 'requested_by_customer'); // 'requested_by_customer' is close enough or use null
        }

        // Execute Transfer (Professional Share)
        if (share > 0 && booking.professional.stripeAccountId) {
            await createTransfer(
                share,
                booking.professional.stripeAccountId,
                bookingId,
                { type: 'qc_timeout_partial_payout' },
                sourceTransactionId
            );
        }

        // Update Booking
        await prisma.$transaction([
            prisma.booking.update({
                where: { id: bookingId },
                data: {
                    status: BookingStatus.completed,
                }
            }),
            prisma.payment.update({
                where: { bookingId },
                data: {
                    refundedAmountCents: share,
                    status: 'partially_refunded'
                }
            }),
            prisma.auditLog.create({
                data: {
                    entity: 'Booking',
                    entityId: bookingId,
                    action: 'qc_timeout_executed',
                    metadata: {
                        gross: booking.payment.amountGross,
                        fee: stripeFeeCents,
                        net: netAmount,
                        share,
                        candidateRefund: share,
                        proPayout: share
                    }
                }
            })
        ]);

        console.log(`[QC] Timeout executed successfully for ${bookingId}`);
    }
};
