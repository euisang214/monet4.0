import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CandidateSettings } from '@/lib/role/candidate/settings';
import { Role } from '@prisma/client';
import { EmptyState } from '@/components/ui/composites/EmptyState';
import { ProfessionalWeeklySlotPicker } from '@/components/bookings/WeeklySlotCalendar';

export default async function CandidateAvailabilityPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

    const availability = await CandidateSettings.getAvailability(session.user.id);
    const availableSlots = availability
        .filter((slot) => !slot.busy)
        .map((slot) => ({ start: slot.start, end: slot.end }));
    const blockedSlotsCount = availability.length - availableSlots.length;

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Availability</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage your time windows</h1>
                <p className="text-gray-600">Set clear availability to make scheduling and confirmations smoother.</p>
            </header>

            {availableSlots.length === 0 ? (
                <EmptyState
                    badge="No slots configured"
                    title="You have not set any available slots yet"
                    description={
                        blockedSlotsCount > 0
                            ? 'Only blocked windows were found. Add available windows in settings to populate the calendar.'
                            : 'Add windows in your settings so professionals can propose times that work for you.'
                    }
                    actionLabel="Open candidate settings"
                    actionHref="/candidate/settings"
                />
            ) : (
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Current availability calendar</h2>
                    <ProfessionalWeeklySlotPicker
                        slots={availableSlots}
                        selectedSlot={null}
                        readOnly
                    />
                    {blockedSlotsCount > 0 && (
                        <p className="mt-4 text-sm text-gray-600">
                            {blockedSlotsCount} blocked slot{blockedSlotsCount === 1 ? '' : 's'} are not shown as available.
                        </p>
                    )}
                </section>
            )}
        </main>
    );
}
