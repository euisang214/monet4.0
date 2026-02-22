
import Link from 'next/link';
import { AdminDisputeService } from '@/lib/role/admin/disputes';
import { format } from 'date-fns';
import { AdminDataTable, type Column } from '@/components/ui/composites/AdminDataTable';
import { StatusBadge } from '@/components/ui/composites/StatusBadge';
import { appRoutes } from '@/lib/shared/routes';

export const dynamic = 'force-dynamic';

type DisputeRow = Awaited<ReturnType<typeof AdminDisputeService.listDisputes>>[number];

function disputeStatusVariant(status: string) {
    if (status === 'open') return 'danger' as const;
    if (status === 'under_review') return 'warning' as const;
    return 'success' as const;
}

const columns: Column<DisputeRow>[] = [
    {
        header: 'Date',
        accessor: (dispute) => format(new Date(dispute.createdAt), 'MMM d, yyyy'),
    },
    {
        header: 'Status',
        accessor: (dispute) => (
            <StatusBadge
                label={dispute.status.replace('_', ' ').toUpperCase()}
                variant={disputeStatusVariant(dispute.status)}
            />
        ),
    },
    {
        header: 'Reason',
        accessor: (dispute) => dispute.reason.replace('_', ' '),
    },
    {
        header: 'Initiator',
        accessor: (dispute) => dispute.initiator.email,
    },
    {
        header: 'Booking ID',
        accessor: (dispute) => <span className="font-mono">{dispute.bookingId.slice(0, 8)}...</span>,
    },
    {
        header: '',
        accessor: (dispute) => (
            <Link href={appRoutes.admin.disputeDetails(dispute.id)} className="text-indigo-600 hover:text-indigo-900">
                View
            </Link>
        ),
        className: 'text-right',
    },
];

export default async function DisputesPage() {
    const disputes = await AdminDisputeService.listDisputes();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
            </div>

            <AdminDataTable
                columns={columns}
                data={disputes}
                getRowKey={(dispute) => dispute.id}
                emptyMessage="No disputes found."
            />
        </div>
    );
}
