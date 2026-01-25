import { prisma } from '@/lib/core/db';
import { BookingStatus } from '@prisma/client';

export const ProfessionalFeedbackService = {
    /**
     * Returns bookings that require feedback from the professional.
     * Exclude those that have already passed QC.
     */
    async getPendingFeedback(professionalId: string) {
        return prisma.booking.findMany({
            where: {
                professionalId: professionalId,
                status: BookingStatus.completed_pending_feedback,
                OR: [
                    { feedback: { is: null } },
                    { feedback: { qcStatus: { not: 'passed' } } }
                ]
            },
            include: {
                candidate: {
                    select: {
                        id: true,
                        email: true,
                    }
                },
                feedback: {
                    select: {
                        qcStatus: true,
                        actions: true // Include actions/text to pre-fill if revising?
                    }
                }
            },
            orderBy: {
                endAt: 'desc'
            }
        });
    },

    /**
     * Submits feedback for a booking and triggers QC.
     */
    async submitFeedback(professionalId: string, data: {
        bookingId: string;
        text: string;
        actions: string[];
        contentRating: number;
        deliveryRating: number;
        valueRating: number;
    }) {
        const booking = await prisma.booking.findUnique({
            where: { id: data.bookingId },
            select: { professionalId: true, status: true }
        });

        if (!booking) {
            throw new Error('Booking not found');
        }

        if (booking.professionalId !== professionalId) {
            throw new Error('Unauthorized');
        }

        if (booking.status !== BookingStatus.completed_pending_feedback) {
            // We might allow updates if it's in 'revise' state which is still pending_feedback?
            // Yes, status shouldn't change until QC passes.
            throw new Error('Booking is not awaiting feedback');
        }

        const wordCount = data.text.trim().split(/\s+/).length;

        // Create or Update Feedback
        await prisma.callFeedback.upsert({
            where: { bookingId: data.bookingId },
            create: {
                bookingId: data.bookingId,
                text: data.text,
                actions: data.actions,
                wordCount,
                contentRating: data.contentRating,
                deliveryRating: data.deliveryRating,
                valueRating: data.valueRating,
                qcStatus: 'missing', // Initial state before QC picks it up
                submittedAt: new Date(),
            },
            update: {
                text: data.text,
                actions: data.actions,
                wordCount,
                contentRating: data.contentRating,
                deliveryRating: data.deliveryRating,
                valueRating: data.valueRating,
                qcStatus: 'missing', // Reset status for re-check
                submittedAt: new Date(),
            }
        });

        // Trigger QC Job
        // Note: we don't await the job completion, just the enqueue
        const { qcQueue } = await import('@/lib/queues');
        await qcQueue.add('validate-feedback', { bookingId: data.bookingId });

        return { success: true };
    }
};
