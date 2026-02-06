import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { getBookingHistory } from '@/lib/shared/bookings/history';
import { EmptyState } from '@/components/ui/EmptyState';

function statusTone(status: string) {
    if (status === 'completed') return 'bg-green-50 text-green-700';
    if (status === 'cancelled') return 'bg-red-50 text-red-700';
    return 'bg-gray-100 text-gray-700';
}

export default async function CandidateHistoryPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

    const { bookings } = await getBookingHistory(session.user.id, 'CANDIDATE', { limit: 50 });

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate History</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Your completed and past bookings</h1>
                <p className="text-gray-600">Review previous sessions and quickly confirm their outcomes.</p>
            </header>

            {bookings.length === 0 ? (
                <EmptyState
                    badge="No history yet"
                    title="No past bookings found"
                    description="Once a consultation is completed or closed, it will appear here."
                    actionLabel="View dashboard"
                    actionHref="/candidate/dashboard"
                />
            ) : (
                <ul className="space-y-4">
                    {bookings.map((booking) => (
                        <li key={booking.id} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-gray-900 mb-1">
                                        {booking.professional.email}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {booking.startAt?.toLocaleDateString()} at {booking.startAt?.toLocaleTimeString()}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full font-semibold ${statusTone(booking.status)}`}>
                                    {booking.status.replace(/_/g, ' ')}
                                </span>
                            </div>
                            {booking.feedback && (
                                <p className="text-sm text-gray-500 mt-3">
                                    Feedback submitted and attached to this booking.
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
