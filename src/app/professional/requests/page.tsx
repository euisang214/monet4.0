import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { BookingStatus, Role } from '@prisma/client';
import { getPendingRequests } from '@/lib/shared/bookings/upcoming';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function ProfessionalRequestsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login?callbackUrl=/professional/requests');
    }

    if (session.user.role !== Role.PROFESSIONAL) {
        redirect('/');
    }

    const requests = await getPendingRequests(session.user.id, 'PROFESSIONAL');

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Requests</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Incoming booking and reschedule requests</h1>
                <p className="text-gray-600">Review candidate-provided times in calendar view and confirm one slot.</p>
            </header>

            {requests.length === 0 ? (
                <EmptyState
                    badge="All clear"
                    title="No pending requests"
                    description="New candidate requests will appear here as soon as they are submitted."
                    actionLabel="Open dashboard"
                    actionHref="/professional/dashboard"
                />
            ) : (
                <ul className="space-y-4">
                    {requests.map((request) => {
                        const isReschedule = request.status === BookingStatus.reschedule_pending;
                        const badgeText = isReschedule ? 'Reschedule' : 'Pending';
                        const badgeClass = isReschedule ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700';
                        const href = isReschedule
                            ? `/professional/bookings/${request.id}/reschedule`
                            : `/professional/bookings/${request.id}/confirm-and-schedule`;
                        const buttonText = isReschedule ? 'Review reschedule' : 'Review & schedule';

                        return (
                        <li key={request.id} className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-gray-900 mb-1">
                                        {request.candidate.email}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        ${((request.priceCents || 0) / 100).toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${badgeClass}`}>
                                        {badgeText}
                                    </span>
                                    {isReschedule ? (
                                        <p className="text-xs text-gray-500 mt-1">Awaiting time selection</p>
                                    ) : (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Expires: {request.expiresAt?.toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                                <Link
                                    href={href}
                                    className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm"
                                >
                                    {buttonText}
                                </Link>
                            </div>
                        </li>
                        );
                    })}
                </ul>
            )}
        </main>
    );
}
