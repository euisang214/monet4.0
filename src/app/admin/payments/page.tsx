import { AdminPaymentService } from '@/lib/role/admin/payments';
import { format } from 'date-fns';
import Link from 'next/link';
import { DataTable, EmptyState, PageHeader, type DataColumn, StatusBadge } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';

export const dynamic = 'force-dynamic';

type PaymentRow = Awaited<ReturnType<typeof AdminPaymentService.listPayments>>[number];

function paymentStatusVariant(status: string) {
    if (status === 'released') return 'success' as const;
    if (status === 'held') return 'info' as const;
    return 'neutral' as const;
}

const columns: DataColumn<PaymentRow>[] = [
    {
        key: 'id',
        header: 'ID / Intent',
        cell: (payment) => (
            <>
                <div className="font-mono text-xs">{payment.id}</div>
                <div className="font-mono text-xs text-gray-400">{payment.stripePaymentIntentId}</div>
            </>
        ),
        priority: 'primary',
    },
    {
        key: 'amount',
        header: 'Amount',
        cell: (payment) => (
            <span className="font-medium text-gray-900">
                {payment.amountGross ? `$${(payment.amountGross / 100).toFixed(2)}` : '-'}
            </span>
        ),
    },
    {
        key: 'status',
        header: 'Status',
        cell: (payment) => (
            <StatusBadge
                label={payment.status.replace(/_/g, ' ')}
                variant={paymentStatusVariant(payment.status)}
            />
        ),
    },
    {
        key: 'booking',
        header: 'Booking',
        cell: (payment) => (
            <Link href={appRoutes.admin.bookingDetails(payment.bookingId)} className="text-blue-600">
                {payment.bookingId.slice(-8)}...
            </Link>
        ),
    },
    {
        key: 'date',
        header: 'Date',
        cell: (payment) => format(payment.createdAt, 'MMM d, HH:mm'),
    },
];

export default async function PaymentsPage() {
    const payments = await AdminPaymentService.listPayments(50);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Admin payments"
                title="Payments"
                description="Inspect captured charges, held payments, and payout progression."
                actions={
                    <a href={appRoutes.api.admin.paymentsExport} className={buttonVariants({ variant: 'secondary' })}>
                    Export CSV
                    </a>
                }
            />

            <DataTable
                columns={columns}
                data={payments}
                getRowKey={(payment) => payment.id}
                density="compact"
                emptyState={
                    <EmptyState
                        title="No payments found."
                        description="Payment rows will appear here once checkout or payout activity exists."
                        badge="Queue empty"
                        layout="inline"
                    />
                }
            />
        </div>
    );
}
