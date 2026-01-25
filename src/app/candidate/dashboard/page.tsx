import React from 'react';
import { auth } from '@/auth';
import { getCandidateBookings } from '@/lib/role/candidate/dashboard';
import { BookingCard } from '@/components/bookings/BookingCard';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function CandidateDashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect('/auth/signin?callbackUrl=/candidate/dashboard');
    }

    const bookings = await getCandidateBookings(session.user.id);

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">My Bookings</h1>

            {bookings.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 mb-4">You haven't requested any bookings yet.</p>
                    <a href="/candidate/browse" className="text-blue-600 hover:underline">
                        Browse Professionals
                    </a>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bookings.map((booking) => (
                        <Link key={booking.id} href={`/candidate/bookings/${booking.id}`} className="block hover:shadow-lg transition-shadow">
                            <BookingCard booking={booking} />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
