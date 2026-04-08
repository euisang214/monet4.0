
import { AdminBookingService } from '@/lib/role/admin/bookings';
import { format } from 'date-fns';
import Link from 'next/link';
import BookingSearch from './BookingSearch';
import { DashboardSummaryStrip, DataTable, EmptyState, PageHeader, type DataColumn, StatusBadge } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type BookingRow = Awaited<ReturnType<typeof AdminBookingService.listBookings>>[number];
type BookingPayment = {
    status: string;
    amountGross: number;
};

type BookingRowWithPayment = BookingRow & {
    payment?: BookingPayment | null;
};

function bookingStatusVariant(status: string) {
    if (status === 'completed') return 'success' as const;
    if (status === 'cancelled' || status === 'declined') return 'neutral' as const;
    if (status === 'dispute_pending') return 'danger' as const;
    return 'info' as const;
}

function paymentStatusVariant(status: string) {
    if (status === 'released') return 'success' as const;
    return 'warning' as const;
}

function formatStatusLabel(value: string) {
    return value.replace(/_/g, ' ');
}

function getBookingPayment(booking: BookingRow): BookingPayment | null {
    return (booking as BookingRowWithPayment).payment ?? null;
}

const columns: DataColumn<BookingRow>[] = [
    {
        key: 'booking',
        header: 'Booking',
        cell: (booking) => (
            <div className={styles.bookingCell}>
                <span className={styles.bookingId}>{booking.id.slice(0, 8)}...</span>
                <span className={styles.bookingMeta}>
                    {booking.startAt ? format(new Date(booking.startAt), 'EEE, MMM d · h:mm a') : 'Schedule pending'}
                </span>
            </div>
        ),
        mobileLabel: 'Booking',
        priority: 'primary',
    },
    {
        key: 'status',
        header: 'Status',
        cell: (booking) => (
            <div className={styles.statusCell}>
                <StatusBadge label={formatStatusLabel(booking.status)} variant={bookingStatusVariant(booking.status)} />
            </div>
        ),
    },
    {
        key: 'participants',
        header: 'Participants',
        cell: (booking) => (
            <div className={styles.participants}>
                <div className={styles.participant}>
                    <span className={styles.participantLabel}>Candidate</span>
                    <span className={styles.participantValue}>{booking.candidateId}</span>
                </div>
                <div className={styles.participant}>
                    <span className={styles.participantLabel}>Professional</span>
                    <span className={styles.participantValue}>{booking.professionalId}</span>
                </div>
            </div>
        ),
    },
    {
        key: 'payment',
        header: 'Payment',
        cell: (booking) => {
            const payment = getBookingPayment(booking);

            return payment ? (
                <div className={styles.paymentCell}>
                    <StatusBadge
                        label={formatStatusLabel(payment.status)}
                        variant={paymentStatusVariant(payment.status)}
                    />
                    <span className={styles.paymentAmount}>
                        ${(payment.amountGross / 100).toFixed(2)}
                    </span>
                </div>
            ) : (
                <span className={styles.emptyPayment}>No payment</span>
            );
        },
    },
    {
        key: 'view',
        header: '',
        cell: (booking) => (
            <Link href={appRoutes.admin.bookingDetails(booking.id)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                View
            </Link>
        ),
        className: styles.actionCell,
        align: 'right',
        mobileLabel: 'Open',
    },
];

export default async function BookingsPage({
    searchParams,
}: {
    searchParams?: {
        q?: string;
    };
}) {
    const query = searchParams?.q || '';
    const bookings = await AdminBookingService.listBookings({ query }, 50);
    const paymentHeldCount = bookings.filter((booking) => getBookingPayment(booking)?.status === 'held').length;
    const paymentReleasedCount = bookings.filter((booking) => getBookingPayment(booking)?.status === 'released').length;
    const disputeCount = bookings.filter((booking) => booking.status === 'dispute_pending').length;
    const summaryItems = [
        { key: 'results', label: 'Results', value: bookings.length, subValue: query ? 'Filtered view' : 'Latest 50 bookings' },
        { key: 'disputes', label: 'Disputes', value: disputeCount, subValue: 'Needs review' },
        { key: 'held', label: 'Payments held', value: paymentHeldCount, subValue: 'Awaiting release' },
        { key: 'released', label: 'Released', value: paymentReleasedCount, subValue: 'Transferred or cleared' },
    ];

    return (
        <div className={styles.page}>
            <PageHeader
                eyebrow="Admin bookings"
                title="Bookings"
                description="Search current bookings and inspect payment state without leaving the queue."
                meta={`${bookings.length} shown`}
                actions={<BookingSearch className={styles.search} />}
            />

            <DashboardSummaryStrip items={summaryItems} className={styles.summaryStrip} aria-label="Booking summary" />

            <DataTable
                columns={columns}
                data={bookings}
                getRowKey={(booking) => booking.id}
                density="compact"
                emptyState={
                    <EmptyState
                        title="No bookings found."
                        description="Adjust the query or check back after new bookings are created."
                        badge="Queue empty"
                        layout="inline"
                    />
                }
            />
        </div>
    );
}
