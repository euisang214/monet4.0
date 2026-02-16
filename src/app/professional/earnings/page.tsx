import { requireRole } from '@/lib/core/api-helpers';
import { Role } from '@prisma/client';
import { ProfessionalEarningsService } from '@/lib/role/professional/earnings';
import { EmptyState } from '@/components/ui/composites/EmptyState';

export default async function ProfessionalEarningsPage() {
    const user = await requireRole(Role.PROFESSIONAL, '/professional/earnings');

    const [earnings, payouts] = await Promise.all([
        ProfessionalEarningsService.getEarningsSummary(user.id),
        ProfessionalEarningsService.getPayoutHistory(user.id, 20),
    ]);

    const formatCurrency = (amountCents: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100);

    return (
        <main className="container py-8">
            <header className="mb-8">
                <p className="text-xs uppercase tracking-wider text-blue-600 mb-2">Professional Earnings</p>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Revenue and payout history</h1>
                <p className="text-gray-600">Monitor paid totals, pending amounts, and each payout event.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <p className="text-sm text-gray-500">Total Earnings</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(earnings.totalEarningsCents)}</p>
                </div>
                <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <p className="text-sm text-gray-500">Pending Payouts</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(earnings.pendingPayoutsCents)}</p>
                </div>
                <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <p className="text-sm text-gray-500">Recent Payouts</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{payouts.length}</p>
                </div>
            </div>

            <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Payout History</h2>

                {payouts.length === 0 ? (
                    <EmptyState
                        badge="No payouts yet"
                        title="No payout records found"
                        description="Once feedback passes QC and payments are released, payout entries will appear here."
                    />
                ) : (
                    <ul className="space-y-3">
                        {payouts.map((payout) => (
                            <li key={payout.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex justify-between items-center gap-3">
                                <div>
                                    <p className="font-medium text-gray-900">{formatCurrency(payout.amountNet)}</p>
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
        </main>
    );
}
