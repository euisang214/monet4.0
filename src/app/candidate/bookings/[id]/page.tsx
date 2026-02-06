import React from 'react';
import { auth } from '@/auth';
import { getBookingDetails } from '@/lib/role/candidate/dashboard';
import { notFound, redirect } from 'next/navigation';
import { BookingActions } from './BookingActions';
import { Role } from '@prisma/client';
import { format } from 'date-fns';
import Link from 'next/link';

function statusTone(status: string) {
    if (status === 'accepted' || status === 'completed') return 'bg-green-50 text-green-800';
    if (status === 'cancelled' || status === 'declined' || status === 'refunded') return 'bg-red-50 text-red-800';
    return 'bg-yellow-50 text-yellow-700';
}

export default async function BookingDetailsPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) {
        redirect(`/login?callbackUrl=/candidate/bookings/${params.id}`);
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

    const booking = await getBookingDetails(params.id, session.user.id);

    if (!booking) {
        notFound();
    }

    return (
        <main className="container py-8 max-w-3xl">
            <div className="mb-6">
                <Link href="/candidate/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                    &larr; Back to Dashboard
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

            <section className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Professional information</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="block text-gray-500 mb-1">Profile</p>
                            <p className="font-medium text-gray-900">
                                {booking.professional.professionalProfile?.title || booking.professional.email}
                            </p>
                            <p className="text-gray-500 text-xs mt-1">
                                {booking.professional.professionalProfile?.title} at {booking.professional.professionalProfile?.employer}
                            </p>
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
