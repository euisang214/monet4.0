import { requireRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { getPendingRequests } from '@/lib/shared/bookings/upcoming';
import { EmptyState, PageHeader } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { ProfessionalRequestListItem } from '@/components/bookings/ProfessionalRequestListItem';

export default async function ProfessionalRequestsPage() {
    const user = await requireRole(Role.PROFESSIONAL, appRoutes.professional.requests);

    const requests = await getPendingRequests(user.id, 'PROFESSIONAL');

    return (
        <main className="space-y-8">
            <PageHeader
                eyebrow="Professional requests"
                title="Incoming booking and reschedule requests"
                description="Review candidate-provided times in calendar view and confirm one slot."
            />

            {requests.length === 0 ? (
                <EmptyState
                    badge="All clear"
                    title="No pending requests"
                    description="New candidate requests will appear here as soon as they are submitted."
                    actionLabel="Open dashboard"
                    actionHref={appRoutes.professional.dashboard}
                    layout="inline"
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
