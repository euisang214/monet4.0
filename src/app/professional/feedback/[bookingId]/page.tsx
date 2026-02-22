import React from 'react';
import { requireRole } from '@/lib/core/api-helpers';
import { prisma } from '@/lib/core/db';
import { notFound } from 'next/navigation';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { Role } from '@prisma/client';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/composites/EmptyState';
import { formatCandidateForProfessionalView } from '@/lib/domain/users/identity-labels';

export default async function FeedbackPage({
    params
}: {
    params: Promise<{ bookingId: string }>
}) {
    const { bookingId } = await params;
    const user = await requireRole(Role.PROFESSIONAL, `/professional/feedback/${bookingId}`);

    const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            candidate: {
                select: {
                    firstName: true,
                    lastName: true,
                    candidateProfile: {
                        select: {
                            experience: {
                                where: { type: 'EXPERIENCE' },
                                orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                                select: {
                                    id: true,
                                    title: true,
                                    company: true,
                                    startDate: true,
                                    endDate: true,
                                    isCurrent: true,
                                },
                            },
                            education: {
                                orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }, { id: 'desc' }],
                                select: {
                                    id: true,
                                    school: true,
                                    startDate: true,
                                    endDate: true,
                                    isCurrent: true,
                                },
                            },
                        },
                    },
                },
            },
            feedback: true
        }
    });

    if (!booking) {
        notFound();
    }

    if (booking.professionalId !== user.id) {
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
            <main className="container py-8">
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
    const candidateLabel = formatCandidateForProfessionalView({
        firstName: booking.candidate.firstName,
        lastName: booking.candidate.lastName,
        experience: booking.candidate.candidateProfile?.experience,
        education: booking.candidate.candidateProfile?.education,
    });

    return (
        <main className="container py-8">
            <Link href="/professional/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                &larr; Back to dashboard
            </Link>
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Feedback</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit consultation feedback</h1>
                <p className="text-sm text-gray-500">
                    For your session with {candidateLabel}.
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
