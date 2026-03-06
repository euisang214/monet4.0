
import { AdminBookingService } from '@/lib/role/admin/bookings';
import { format } from 'date-fns';
import Link from 'next/link';
import BookingSearch from './BookingSearch';
import { DataTable, EmptyState, PageHeader, type DataColumn, StatusBadge, SurfaceCard } from '@/components/ui';
import { appRoutes } from '@/lib/shared/routes';
import { buttonVariants } from '@/components/ui/primitives/Button';

export const dynamic = 'force-dynamic';

type BookingRow = Awaited<ReturnType<typeof AdminBookingService.listBookings>>[number];

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

const columns: DataColumn<BookingRow>[] = [
    {
        key: 'id',
        header: 'ID',
        cell: (booking) => <span className="font-mono text-xs text-gray-500">{booking.id.slice(0, 8)}...</span>,
        mobileLabel: 'Booking ID',
        priority: 'primary',
    },
    {
        key: 'start-date',
        header: 'Start Date',
        cell: (booking) => (booking.startAt ? format(new Date(booking.startAt), 'MMM d, yy') : '-'),
    },
    {
        key: 'status',
        header: 'Status',
        cell: (booking) => <StatusBadge label={booking.status} variant={bookingStatusVariant(booking.status)} />,
    },
    {
        key: 'candidate',
        header: 'Candidate',
        cell: (booking) => booking.candidateId,
    },
    {
        key: 'professional',
        header: 'Professional',
        cell: (booking) => booking.professionalId,
    },
    {
        key: 'date',
        header: 'Date',
        cell: (booking) => (booking.startAt ? format(new Date(booking.startAt), 'MMM d, h:mm a') : '-'),
    },
    {
        key: 'payment',
        header: 'Payment',
        cell: (booking) =>
            (booking as any).payment ? (
                <StatusBadge
                    label={`${(booking as any).payment.status} ($${((booking as any).payment.amountGross / 100).toFixed(2)})`}
                    variant={paymentStatusVariant((booking as any).payment.status)}
                />
            ) : (
                '-'
            ),
    },
    {
        key: 'view',
        header: '',
        cell: (booking) => (
            <Link href={appRoutes.admin.bookingDetails(booking.id)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
                View
            </Link>
        ),
        className: 'text-right',
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

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="Admin bookings"
                title="Bookings"
                description="Search current bookings and inspect payment state without leaving the queue."
            />

            <SurfaceCard tone="muted">
                <BookingSearch />
            </SurfaceCard>

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
