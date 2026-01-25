import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { getPendingRequests } from '@/lib/shared/bookings/upcoming';

export default async function ProfessionalRequestsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.role !== Role.PROFESSIONAL) {
        redirect('/');
    }

    const requests = await getPendingRequests(session.user.id, 'PROFESSIONAL');

    return (
        <main className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Booking Requests</h1>

            {requests.length === 0 ? (
                <p className="text-gray-500">No pending requests.</p>
            ) : (
                <ul className="space-y-4">
                    {requests.map((request) => (
                        <li key={request.id} className="p-4 border rounded">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold">
                                        {request.candidate.email}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        ${((request.priceCents || 0) / 100).toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700">
                                        Pending
                                    </span>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Expires: {request.expiresAt?.toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex gap-2">
                                <a
                                    href={`/professional/bookings/${request.id}/confirm-and-schedule`}
                                    className="px-3 py-1 bg-green-500 text-white text-sm rounded"
                                >
                                    Accept
                                </a>
                                <button className="px-3 py-1 bg-red-500 text-white text-sm rounded">
                                    Decline
                                </button>
                            </div>
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
