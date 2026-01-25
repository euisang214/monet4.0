import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { ProfessionalEarningsService } from '@/lib/role/professional/earnings';

export default async function ProfessionalEarningsPage() {
    const session = await auth();

    if (!session?.user) {
        redirect('/login');
    }

    if (session.user.role !== Role.PROFESSIONAL) {
        redirect('/');
    }

    const [earnings, payouts] = await Promise.all([
        ProfessionalEarningsService.getEarningsSummary(session.user.id),
        ProfessionalEarningsService.getPayoutHistory(session.user.id, 20),
    ]);

    return (
        <main className="container mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Earnings</h1>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 border rounded">
                    <p className="text-sm text-gray-500">Total Earnings</p>
                    <p className="text-2xl font-bold">
                        ${(earnings.totalEarningsCents / 100).toFixed(2)}
                    </p>
                </div>
                <div className="p-4 border rounded">
                    <p className="text-sm text-gray-500">Pending Payouts</p>
                    <p className="text-2xl font-bold">
                        ${(earnings.pendingPayoutsCents / 100).toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Payout History */}
            <section>
                <h2 className="text-lg font-semibold mb-4">Payout History</h2>

                {payouts.length === 0 ? (
                    <p className="text-gray-500">No payouts yet.</p>
                ) : (
                    <ul className="space-y-2">
                        {payouts.map((payout) => (
                            <li key={payout.id} className="p-3 border rounded flex justify-between items-center">
                                <div>
                                    <p className="font-medium">${(payout.amountNet / 100).toFixed(2)}</p>
                                    <p className="text-xs text-gray-500">
                                        Booking: {payout.booking.startAt?.toLocaleDateString() || 'N/A'}
                                    </p>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded ${payout.status === 'paid' ? 'bg-green-100 text-green-700' :
                                    payout.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {payout.status}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mt-8 p-4 bg-gray-100 rounded">
                <p className="text-sm text-gray-600">
                    DevLink components will replace this interface.
                </p>
            </section>
        </main>
    );
}
