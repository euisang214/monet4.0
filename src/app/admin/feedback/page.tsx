import { AdminFeedbackService } from '@/lib/role/admin/feedback';
import { format } from 'date-fns';
import Link from 'next/link';
import { AdminDataTable, type Column } from '@/components/ui/composites/AdminDataTable';
import { StatusBadge } from '@/components/ui/composites/StatusBadge';

export const dynamic = 'force-dynamic';

type FeedbackRow = Awaited<ReturnType<typeof AdminFeedbackService.listFeedback>>[number];

function qcStatusVariant(status: string) {
    if (status === 'passed') return 'success' as const;
    if (status === 'revise') return 'warning' as const;
    return 'danger' as const;
}

const columns: Column<FeedbackRow>[] = [
    {
        header: 'Booking',
        accessor: (fb) => (
            <Link href={`/admin/bookings/${fb.bookingId}`} className="text-blue-600">
                {fb.bookingId.slice(-8)}...
            </Link>
        ),
    },
    {
        header: 'QC Status',
        accessor: (fb) => <StatusBadge label={fb.qcStatus} variant={qcStatusVariant(fb.qcStatus)} />,
    },
    {
        header: 'Ratings (C/D/V)',
        accessor: (fb) => (
            <span className="font-mono text-gray-700">
                {fb.contentRating}/{fb.deliveryRating}/{fb.valueRating}
            </span>
        ),
    },
    {
        header: 'Word Count',
        accessor: (fb) => fb.wordCount,
    },
    {
        header: 'Submitted',
        accessor: (fb) => format(fb.submittedAt, 'MMM d, HH:mm'),
    },
];

export default async function FeedbackPage() {
    const feedbacks = await AdminFeedbackService.listFeedback(50);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Feedback</h1>
                <a
                    href="/api/admin/export/feedback"
                    className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Export CSV
                </a>
            </div>

            <AdminDataTable
                columns={columns}
                data={feedbacks}
                getRowKey={(fb) => fb.bookingId}
                emptyMessage="No feedback found."
            />
        </div>
    );
}
