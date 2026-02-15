
import { AdminBookingService } from '@/lib/role/admin/bookings';
import { format } from 'date-fns';
import Link from 'next/link';
import BookingSearch from './BookingSearch';
import { AdminDataTable, type Column } from '@/components/ui/composites/AdminDataTable';
import { StatusBadge } from '@/components/ui/composites/StatusBadge';

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

const columns: Column<BookingRow>[] = [
    {
        header: 'ID',
        accessor: (booking) => <span className="font-mono text-xs text-gray-500">{booking.id.slice(0, 8)}...</span>,
    },
    {
        header: 'Start Date',
        accessor: (booking) => (booking.startAt ? format(new Date(booking.startAt), 'MMM d, yy') : '-'),
    },
    {
        header: 'Status',
        accessor: (booking) => <StatusBadge label={booking.status} variant={bookingStatusVariant(booking.status)} />,
    },
    {
        header: 'Candidate',
        accessor: (booking) => booking.candidateId,
    },
    {
        header: 'Professional',
        accessor: (booking) => booking.professionalId,
    },
    {
        header: 'Date',
        accessor: (booking) => (booking.startAt ? format(new Date(booking.startAt), 'MMM d, h:mm a') : '-'),
    },
    {
        header: 'Payment',
        accessor: (booking) =>
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
        header: '',
        accessor: () => null,
        className: 'text-right',
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
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            </div>

            <div className="bg-white p-4 shadow sm:rounded-lg">
                <BookingSearch />
            </div>

            <AdminDataTable
                columns={columns}
                data={bookings}
                getRowKey={(booking) => booking.id}
                emptyMessage="No bookings found."
            />
        </div>
    );
}
