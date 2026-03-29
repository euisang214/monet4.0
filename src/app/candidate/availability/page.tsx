import { requireRole } from '@/lib/core/api-helpers';
import { CandidateAvailability } from '@/lib/role/candidate/availability';
import { Role } from '@prisma/client';
import { CandidateAvailabilityEditor } from './CandidateAvailabilityEditor';
import { PageHeader } from '@/components/ui';

export default async function CandidateAvailabilityPage() {
    const user = await requireRole(Role.CANDIDATE, '/candidate/availability');

    const { initialAvailabilitySlots, candidateTimezone, isGoogleCalendarConnected } =
        await CandidateAvailability.getSavedAvailabilitySeed(user.id);

    return (
        <main className="space-y-8">
            <PageHeader
                eyebrow="Candidate availability"
                title="Manage your time windows"
                description="Toggle your 30-minute slots directly on this page and save when ready."
            />

            <CandidateAvailabilityEditor
                initialAvailabilitySlots={initialAvailabilitySlots}
                calendarTimezone={candidateTimezone}
                isGoogleCalendarConnected={isGoogleCalendarConnected}
            />
        </main>
    );
}
