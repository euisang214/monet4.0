import React from 'react';
import { auth } from '@/auth';
import { getCandidateBookings } from '@/lib/role/candidate/dashboard';
import { BookingCard } from '@/components/bookings/BookingCard';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export const dynamic = 'force-dynamic';

export default async function CandidateDashboardPage() {
    const session = await auth();
    if (!session?.user) {
        redirect('/login?callbackUrl=/candidate/dashboard');
    }

    const bookings = await getCandidateBookings(session.user.id);

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Dashboard</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Your active and recent bookings</h1>
                <p className="text-gray-600">
                    Track session status, view scheduling progress, and jump directly into booking details.
                </p>
            </header>

            {bookings.length === 0 ? (
                <EmptyState
                    badge="No bookings yet"
                    title="You have not requested a consultation yet"
                    description="Browse professionals to find someone aligned with your goals, then request your first booking."
                    actionLabel="Browse professionals"
                    actionHref="/candidate/browse"
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bookings.map((booking) => (
                        <Link key={booking.id} href={`/candidate/bookings/${booking.id}`} className="block hover:shadow-lg transition-shadow">
                            <BookingCard booking={booking} />
                        </Link>
                    ))}
                </div>
            )}
        </main>
    );
}
