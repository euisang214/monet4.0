import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { CandidateSettings } from '@/lib/role/candidate/settings';
import { Role } from '@prisma/client';

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
        <main className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Manage Availability</h1>

            <section className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Your Availability Slots</h2>

                {availability.length === 0 ? (
                    <p className="text-gray-500">No availability slots set.</p>
                ) : (
                    <ul className="space-y-2">
                        {availability.map((slot) => (
                            <li key={slot.id} className="p-3 border rounded">
                                <div className="flex justify-between items-center">
                                    <span>
                                        {slot.start.toLocaleDateString()} {slot.start.toLocaleTimeString()} - {slot.end.toLocaleTimeString()}
                                    </span>
                                    <span className={slot.busy ? 'text-red-500' : 'text-green-500'}>
                                        {slot.busy ? 'Busy' : 'Available'}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="p-4 bg-gray-100 rounded">
                <p className="text-sm text-gray-600">
                    DevLink components will replace this interface.
                </p>
            </section>
        </main>
    );
}
