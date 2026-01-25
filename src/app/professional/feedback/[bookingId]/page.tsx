import React from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/core/db';
import { redirect, notFound } from 'next/navigation';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { Role } from '@prisma/client';

export default async function FeedbackPage({
    params
}: {
    params: Promise<{ bookingId: string }>
}) {
    const { bookingId } = await params;
    const session = await auth();

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        redirect('/auth/signin');
    }

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            candidate: {
                select: { email: true }
            },
            feedback: true
        }
    });

    if (!booking) {
        notFound();
    }

    if (booking.professionalId !== session.user.id) {
        return (
            <div className="p-8 text-center text-red-600">
                Unauthorized access to this booking.
            </div>
        );
    }

    // Status check?
    // If completed or completed_pending_feedback, we allow viewing/editing?
    // If "completed" (QC passed), maybe show read-only or redirect?
    // For now, if "completed", the form might be weird if it resubmits.
    // But let's assume this page is for ACTION.
    // If QC passed, maybe show "Feedback Submitted" message.

    if (booking.feedback?.qcStatus === 'passed') {
        return (
            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold mb-4">Feedback Submitted</h1>
                <p className="text-gray-600">
                    You have successfully provided feedback for this session. The booking is complete.
                </p>
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                    <h3 className="font-semibold mb-2">Your Feedback:</h3>
                    <p className="whitespace-pre-wrap">{booking.feedback.text}</p>
                </div>
            </div>
        );
    }

    // Initial data for revision
    const initialData = booking.feedback ? {
        text: booking.feedback.text,
        actions: booking.feedback.actions,
    } : undefined;

    return (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Submit Consultation Feedback</h1>
                <p className="mt-1 text-sm text-gray-500">
                    For your session with {booking.candidate.email}.
                </p>
                <div className="mt-2 text-sm text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-200">
                    <strong>Important:</strong> Your payment will be released only after your feedback passes our Quality Control check.
                    Please provide at least 200 words and 3 concrete action items.
                </div>
            </div>

            <FeedbackForm bookingId={bookingId} initialData={initialData} />
        </div>
    );
}
