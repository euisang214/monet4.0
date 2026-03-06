import { AdminFeedbackService } from '@/lib/role/admin/feedback';
import { format } from 'date-fns';
import Link from 'next/link';
import { DataTable, EmptyState, PageHeader, type DataColumn, StatusBadge } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';

export const dynamic = 'force-dynamic';

type FeedbackRow = Awaited<ReturnType<typeof AdminFeedbackService.listFeedback>>[number];

function qcStatusVariant(status: string) {
    if (status === 'passed') return 'success' as const;
    if (status === 'revise') return 'warning' as const;
    return 'danger' as const;
}

const columns: DataColumn<FeedbackRow>[] = [
    {
        key: 'booking',
        header: 'Booking',
        cell: (fb) => (
            <Link href={appRoutes.admin.bookingDetails(fb.bookingId)} className="text-blue-600">
                {fb.bookingId.slice(-8)}...
            </Link>
        ),
        priority: 'primary',
    },
    {
        key: 'qc-status',
        header: 'QC Status',
        cell: (fb) => <StatusBadge label={fb.qcStatus} variant={qcStatusVariant(fb.qcStatus)} />,
    },
    {
        key: 'ratings',
        header: 'Ratings (C/D/V)',
        cell: (fb) => (
            <span className="font-mono text-gray-700">
                {fb.contentRating}/{fb.deliveryRating}/{fb.valueRating}
            </span>
        ),
    },
    {
        key: 'word-count',
        header: 'Word Count',
        cell: (fb) => fb.wordCount,
    },
    {
        key: 'submitted',
        header: 'Submitted',
        cell: (fb) => format(fb.submittedAt, 'MMM d, HH:mm'),
    },
];

export default async function FeedbackPage() {
    const feedbacks = await AdminFeedbackService.listFeedback(50);

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Admin feedback"
                title="Feedback"
                description="Review QC status, ratings, and submission density across recent sessions."
                actions={
                    <a href={appRoutes.api.admin.feedbackExport} className={buttonVariants({ variant: 'secondary' })}>
                    Export CSV
                    </a>
                }
            />

            <DataTable
                columns={columns}
                data={feedbacks}
                getRowKey={(fb) => fb.bookingId}
                density="compact"
                emptyState={
                    <EmptyState
                        title="No feedback found."
                        description="Feedback rows will appear here once sessions have been reviewed."
                        badge="Queue empty"
                        layout="inline"
                    />
                }
            />
        </div>
    );
}
