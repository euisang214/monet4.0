import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CandidateSettings } from '@/lib/role/candidate/settings';
import { Role } from '@prisma/client';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function CandidateAvailabilityPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.role !== Role.CANDIDATE) {
        redirect('/');
    }

    const availability = await CandidateSettings.getAvailability(session.user.id);

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Candidate Availability</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage your time windows</h1>
                <p className="text-gray-600">Set clear availability to make scheduling and confirmations smoother.</p>
            </header>

            {availability.length === 0 ? (
                <EmptyState
                    badge="No slots configured"
                    title="You have not set any availability yet"
                    description="Add windows in your settings so professionals can propose times that work for you."
                    actionLabel="Open candidate settings"
                    actionHref="/candidate/settings"
                />
            ) : (
                <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Current availability slots</h2>
                    <ul className="space-y-3">
                        {availability.map((slot) => (
                            <li key={slot.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                <div className="flex justify-between items-center gap-3">
                                    <span className="text-sm text-gray-700">
                                        {slot.start.toLocaleDateString()} {slot.start.toLocaleTimeString()} - {slot.end.toLocaleTimeString()}
                                    </span>
                                    <span className={`text-sm font-semibold ${slot.busy ? 'text-red-600' : 'text-green-700'}`}>
                                        {slot.busy ? 'Busy' : 'Available'}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
        </main>
    );
}
