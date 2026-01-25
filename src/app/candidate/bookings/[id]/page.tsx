import React from 'react';
import { auth } from '@/auth';
import { getBookingDetails } from '@/lib/role/candidate/dashboard';
import { notFound, redirect } from 'next/navigation';
import { BookingActions } from './BookingActions';
import { Role } from '@prisma/client';
import { format } from 'date-fns';

export default async function BookingDetailsPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) {
        redirect(`/auth/signin?callbackUrl=/candidate/bookings/${params.id}`);
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

    const booking = await getBookingDetails(params.id, session.user.id);

    if (!booking) {
        notFound();
    }

    return (
        <div className="container mx-auto py-8 max-w-3xl">
            <div className="mb-6">
                <a href="/candidate/dashboard" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
                    &larr; Back to Dashboard
                </a>
                <div className="flex justify-between items-start">
                    <h1 className="text-3xl font-bold">Booking Details</h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium 
              ${booking.status === 'accepted' ? 'bg-green-100 text-green-800' :
                            booking.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'}`}>
                        {booking.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold mb-4">Professional Information</h2>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <label className="block text-gray-500">Name</label>
                            <div className="font-medium">
                                {/* User model might not have name, use profile info or email */}
                                {booking.professional.professionalProfile?.title || booking.professional.email}
                            </div>
                            <div className="text-gray-500 text-xs">
                                {booking.professional.professionalProfile?.title} at {booking.professional.professionalProfile?.employer}
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-500">Rate</label>
                            <div className="font-medium">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((booking.priceCents || 0) / 100)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold mb-4">Schedule</h2>
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
                <BookingActions booking={booking} />
            </div>
        </div>
    );
}
