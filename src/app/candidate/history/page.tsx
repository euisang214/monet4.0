import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { getBookingHistory } from '@/lib/shared/bookings/history';

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
        <main className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Booking History</h1>

            {bookings.length === 0 ? (
                <p className="text-gray-500">No past bookings.</p>
            ) : (
                <ul className="space-y-4">
                    {bookings.map((booking) => (
                        <li key={booking.id} className="p-4 border rounded">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">
                                        {booking.professional.email}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        {booking.startAt?.toLocaleDateString()} at {booking.startAt?.toLocaleTimeString()}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded ${booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                                    booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                    {booking.status}
                                </span>
                            </div>
                            {booking.feedback && (
                                <p className="text-sm text-gray-500 mt-2">
                                    Feedback received
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            <section className="mt-8 p-4 bg-gray-100 rounded">
                <p className="text-sm text-gray-600">
                    DevLink components will replace this interface.
                </p>
            </section>
        </main>
    );
}
