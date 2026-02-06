import React from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/core/db';
import { redirect, notFound } from 'next/navigation';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { Role } from '@prisma/client';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function FeedbackPage({
    params
}: {
    params: Promise<{ bookingId: string }>
}) {
    const { bookingId } = await params;
    const session = await auth();

    if (!session || session.user.role !== Role.PROFESSIONAL) {
        redirect(`/login?callbackUrl=/professional/feedback/${bookingId}`);
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
            <main className="container py-12">
                <EmptyState
                    badge="Unauthorized"
                    title="You do not have access to this booking"
                    description="This feedback item belongs to another professional account."
                    actionLabel="Back to dashboard"
                    actionHref="/professional/dashboard"
                />
            </main>
        );
    }

    if (booking.feedback?.qcStatus === 'passed') {
        return (
            <main className="max-w-3xl mx-auto px-4 py-8">
                <Link href="/professional/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                    &larr; Back to dashboard
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 mb-3">Feedback submitted</h1>
                <p className="text-gray-600 mb-6">
                    You have successfully provided feedback for this session. The booking is complete.
                </p>
                <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="font-semibold mb-2">Your Feedback:</h3>
                    <p className="whitespace-pre-wrap">{booking.feedback.text}</p>
                </div>
            </main>
        );
    }

    const initialData = booking.feedback ? {
        text: booking.feedback.text,
        actions: booking.feedback.actions,
    } : undefined;

    return (
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Link href="/professional/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                &larr; Back to dashboard
            </Link>
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Feedback</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit consultation feedback</h1>
                <p className="text-sm text-gray-500">
                    For your session with {booking.candidate.email}.
                </p>
                <div className="mt-2 text-sm text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-200">
                    <strong>Important:</strong> Your payment will be released only after your feedback passes our Quality Control check.
                    Please provide at least 200 words and 3 concrete action items.
                </div>
            </header>

            <FeedbackForm bookingId={bookingId} initialData={initialData} />
        </main>
    );
}
