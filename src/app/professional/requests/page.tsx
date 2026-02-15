import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { getPendingRequests } from '@/lib/shared/bookings/upcoming';
import { EmptyState } from '@/components/ui/composites/EmptyState';
import { appRoutes } from '@/lib/shared/routes';
import { ProfessionalRequestListItem } from '@/components/bookings/ProfessionalRequestListItem';

export default async function ProfessionalRequestsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect(`/login?callbackUrl=${appRoutes.professional.requests}`);
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
                    actionHref={appRoutes.professional.dashboard}
                />
            ) : (
                <ul className="space-y-4">
                    {requests.map((request) => (
                        <ProfessionalRequestListItem key={request.id} booking={request} />
                    ))}
                </ul>
            )}
        </main>
    );
}
