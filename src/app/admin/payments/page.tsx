import { AdminPaymentService } from '@/lib/role/admin/payments';
import { format } from 'date-fns';
import Link from 'next/link';
import { AdminDataTable, type Column } from '@/components/ui/composites/AdminDataTable';
import { StatusBadge } from '@/components/ui/composites/StatusBadge';

type PaymentRow = Awaited<ReturnType<typeof AdminPaymentService.listPayments>>[number];

function paymentStatusVariant(status: string) {
    if (status === 'released') return 'success' as const;
    if (status === 'held') return 'info' as const;
    return 'neutral' as const;
}

const columns: Column<PaymentRow>[] = [
    {
        header: 'ID / Intent',
        accessor: (payment) => (
            <>
                <div className="font-mono text-xs">{payment.id}</div>
                <div className="font-mono text-xs text-gray-400">{payment.stripePaymentIntentId}</div>
            </>
        ),
    },
    {
        header: 'Amount',
        accessor: (payment) => (
            <span className="font-medium text-gray-900">
                {payment.amountGross ? `$${(payment.amountGross / 100).toFixed(2)}` : '-'}
            </span>
        ),
    },
    {
        header: 'Status',
        accessor: (payment) => (
            <StatusBadge
                label={payment.status.replace(/_/g, ' ')}
                variant={paymentStatusVariant(payment.status)}
            />
        ),
    },
    {
        header: 'Booking',
        accessor: (payment) => (
            <Link href={`/admin/bookings/${payment.bookingId}`} className="text-blue-600">
                {payment.bookingId.slice(-8)}...
            </Link>
        ),
    },
    {
        header: 'Date',
        accessor: (payment) => format(payment.createdAt, 'MMM d, HH:mm'),
    },
];

export default async function PaymentsPage() {
    const payments = await AdminPaymentService.listPayments(50);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
                <a
                    href="/api/admin/export/payments"
                    className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Export CSV
                </a>
            </div>

            <AdminDataTable
                columns={columns}
                data={payments}
                getRowKey={(payment) => payment.id}
                emptyMessage="No payments found."
            />
        </div>
    );
}
