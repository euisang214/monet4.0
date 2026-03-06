
import Link from 'next/link';
import { AdminDisputeService } from '@/lib/role/admin/disputes';
import { format } from 'date-fns';
import { DataTable, EmptyState, PageHeader, type DataColumn, StatusBadge } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';

export const dynamic = 'force-dynamic';

type DisputeRow = Awaited<ReturnType<typeof AdminDisputeService.listDisputes>>[number];

function disputeStatusVariant(status: string) {
    if (status === 'open') return 'danger' as const;
    if (status === 'under_review') return 'warning' as const;
    return 'success' as const;
}

const columns: DataColumn<DisputeRow>[] = [
    {
        key: 'date',
        header: 'Date',
        cell: (dispute) => format(new Date(dispute.createdAt), 'MMM d, yyyy'),
        priority: 'primary',
    },
    {
        key: 'status',
        header: 'Status',
        cell: (dispute) => (
            <StatusBadge
                label={dispute.status.replace('_', ' ').toUpperCase()}
                variant={disputeStatusVariant(dispute.status)}
            />
        ),
    },
    {
        key: 'reason',
        header: 'Reason',
        cell: (dispute) => dispute.reason.replace('_', ' '),
    },
    {
        key: 'initiator',
        header: 'Initiator',
        cell: (dispute) => dispute.initiator.email,
    },
    {
        key: 'booking-id',
        header: 'Booking ID',
        cell: (dispute) => <span className="font-mono">{dispute.bookingId.slice(0, 8)}...</span>,
    },
    {
        key: 'view',
        header: '',
        cell: (dispute) => (
            <Link href={appRoutes.admin.disputeDetails(dispute.id)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                View
            </Link>
        ),
        className: 'text-right',
        align: 'right',
        mobileLabel: 'Open',
    },
];

export default async function DisputesPage() {
    const disputes = await AdminDisputeService.listDisputes();

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Admin disputes"
                title="Disputes"
                description="Track open disputes, review status, and jump directly into resolution detail."
            />

            <DataTable
                columns={columns}
                data={disputes}
                getRowKey={(dispute) => dispute.id}
                density="compact"
                emptyState={
                    <EmptyState
                        title="No disputes found."
                        description="Open disputes will appear here once candidates or professionals raise them."
                        badge="Queue empty"
                        layout="inline"
                    />
                }
            />
        </div>
    );
}
