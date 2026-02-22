import React from 'react';
import { requireRole } from '@/lib/core/api-helpers';
import { getCandidateBookingDetails } from '@/lib/role/candidate/chats';
import { notFound } from 'next/navigation';
import { BookingActions } from './BookingActions';
import { BookingStatus, Role } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';
import { appRoutes } from '@/lib/shared/routes';
import {
    formatProfessionalForCandidateView,
    shouldRevealProfessionalNameForCandidateStatus,
} from '@/lib/domain/users/identity-labels';

function statusTone(status: string) {
    if (status === 'accepted' || status === 'completed') return 'bg-green-50 text-green-800';
    if (status === 'cancelled' || status === 'declined' || status === 'refunded') return 'bg-red-50 text-red-800';
    return 'bg-yellow-50 text-yellow-700';
}

export default async function BookingDetailsPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const user = await requireRole(Role.CANDIDATE, `/candidate/bookings/${params.id}`);

    const booking = await getCandidateBookingDetails(params.id, user.id);

    if (!booking) {
        notFound();
    }

    const isCompleted = booking.status === BookingStatus.completed;
    const professionalLabel = formatProfessionalForCandidateView({
        firstName: booking.professional.firstName,
        lastName: booking.professional.lastName,
        title: booking.professional.professionalProfile?.title,
        company: booking.professional.professionalProfile?.employer,
        revealName: shouldRevealProfessionalNameForCandidateStatus(booking.status),
    });

    return (
        <main className="container py-8 max-w-3xl">
            <div className="mb-6">
                <Link href={appRoutes.candidate.chats} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                    &larr; Back to Chats
                </Link>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Booking Details</p>
                        <h1 className="text-3xl font-bold text-gray-900">Session overview</h1>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusTone(booking.status)}`}>
                        {booking.status.replace(/_/g, ' ')}
                    </span>
                </div>
            </div>

            {isCompleted ? (
                <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden mb-6">
                    <div className="p-6 border-b border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-900">Professional Feedback</h2>
                        {booking.feedback?.submittedAt ? (
                            <p className="text-sm text-gray-500 mt-1">
                                Submitted {format(new Date(booking.feedback.submittedAt), 'PPP p')}
                            </p>
                        ) : null}
                    </div>

                    {booking.feedback ? (
                        <div className="p-6 space-y-6">
                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Written Feedback</h3>
                                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{booking.feedback.text}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Action Items</h3>
                                <ul className="list-disc pl-5 space-y-1 text-gray-800">
                                    {booking.feedback.actions.map((action, idx) => (
                                        <li key={`${booking.id}-feedback-action-${idx}`}>{action}</li>
                                    ))}
                                </ul>
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">Ratings</h3>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                        <p className="text-xs text-gray-500">Content</p>
                                        <p className="text-lg font-semibold text-gray-900">{booking.feedback.contentRating}/5</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                        <p className="text-xs text-gray-500">Delivery</p>
                                        <p className="text-lg font-semibold text-gray-900">{booking.feedback.deliveryRating}/5</p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                        <p className="text-xs text-gray-500">Value</p>
                                        <p className="text-lg font-semibold text-gray-900">{booking.feedback.valueRating}/5</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6">
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                Feedback is not available yet for this completed booking.
                            </div>
                        </div>
                    )}
                </section>
            ) : null}

            <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional information</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="block text-gray-500 mb-1">Profile</p>
                            <p className="font-medium text-gray-900">{professionalLabel}</p>
                        </div>
                        <div>
                            <p className="block text-gray-500 mb-1">Rate</p>
                            <p className="font-medium text-gray-900">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((booking.priceCents || 0) / 100)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Schedule</h2>
                    <div className="text-gray-700">
                        {booking.startAt ? (
                            <div>
                                <p className="font-medium">{format(new Date(booking.startAt), 'PPP')}</p>
                                <p>{format(new Date(booking.startAt), 'p')} - {format(new Date(booking.endAt!), 'p')}</p>
                                <p className="text-sm text-gray-500 mt-1">{booking.timezone}</p>
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">Scheduling pending...</p>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-gray-50">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
                    <BookingActions booking={booking} />
                </div>
            </section>
        </main>
    );
}
