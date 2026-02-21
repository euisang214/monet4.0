import { requireRole } from '@/lib/core/api-helpers';
import { CandidateSettings } from '@/lib/role/candidate/settings';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/core/db';
import { CandidateAvailabilityEditor } from './CandidateAvailabilityEditor';

export default async function CandidateAvailabilityPage() {
    const user = await requireRole(Role.CANDIDATE, '/candidate/availability');

    const [availability, candidate] = await Promise.all([
        CandidateSettings.getAvailability(user.id),
        prisma.user.findUnique({
            where: { id: user.id },
            select: { timezone: true },
        }),
    ]);
    const now = new Date();
    const initialAvailabilitySlots = availability
        .filter((slot) => !slot.busy)
        .filter((slot) => slot.end > now)
        .map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }));
    const calendarTimezone = candidate?.timezone || 'UTC';

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Availability</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage your time windows</h1>
                <p className="text-gray-600">Toggle your 30-minute slots directly on this page and save when ready.</p>
            </header>

            <CandidateAvailabilityEditor
                initialAvailabilitySlots={initialAvailabilitySlots}
                calendarTimezone={calendarTimezone}
            />
        </main>
    );
}
