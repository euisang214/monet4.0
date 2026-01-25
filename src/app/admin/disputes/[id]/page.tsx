
import { prisma } from '@/lib/core/db';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import DisputeResolutionForm from './DisputeResolutionForm';

export const dynamic = 'force-dynamic';

export default async function DisputeDetailPage(props: {
    params: Promise<{ id: string }>;
}) {
    const params = await props.params;
    const dispute = await prisma.dispute.findUnique({
        where: { id: params.id },
        include: {
            initiator: true,
            booking: {
                include: {
                    professional: true, // Professional IS a User
                    candidate: true,    // Candidate IS a User
                    payment: true,
                },
            },
            resolvedBy: true,
        },
    });

    if (!dispute) {
        notFound();
    }

    const { booking } = dispute;
    // Fallback for candidate if relation not populated/named well (Prisma calls it whatever schema says)
    // Re-reading CLAUDE.md schema for Booking:
    // candidateId String
    // professionalId String
    // ... relations
    // It doesn't explicitly list relation fields in the snippet, but usually it's `candidate` and `professional`.

    // Safe calculation
    const payment = booking.payment;
    const maxRefund = payment ? (payment.amountGross - payment.refundedAmountCents) : 0;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Dispute Details</h1>
                <span className={`px-3 py-1 text-sm font-semibold rounded-full 
          ${dispute.status === 'open' ? 'bg-red-100 text-red-800' :
                        dispute.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'}`}>
                    {dispute.status.toUpperCase()}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Dispute Info */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Information</h3>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200">
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">ID</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{dispute.id}</dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Reason</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{dispute.reason}</dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Description</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{dispute.description}</dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Initiator</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{dispute.initiator.email}</dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{format(new Date(dispute.createdAt), 'PPpp')}</dd>
                            </div>
                        </dl>
                    </div>
                </div>

                {/* Booking Info */}
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Booking Context</h3>
                    </div>
                    <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
                        <dl className="sm:divide-y sm:divide-gray-200">
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Booking ID</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{booking.id}</dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Status</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{booking.status}</dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Amount</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                    {payment ? `$${(payment.amountGross / 100).toFixed(2)}` : 'N/A'}
                                </dd>
                            </div>
                            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500">Payment Status</dt>
                                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                                    {payment?.status || 'N/A'}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
            </div>

            {/* Resolution Area */}
            {dispute.status !== 'resolved' && (
                <DisputeResolutionForm
                    disputeId={dispute.id}
                    maxRefundAmount={maxRefund}
                />
            )}

            {/* Resolution History */}
            {dispute.status === 'resolved' && (
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Resolution Details</h3>
                    <p className="mt-2 text-sm text-gray-600">
                        Resolved by <span className="font-medium">{dispute.resolvedBy?.email || 'Unknown'}</span> on {dispute.resolvedAt ? format(new Date(dispute.resolvedAt), 'PPpp') : 'N/A'}
                    </p>
                    <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700">Notes</h4>
                        <p className="mt-1 text-sm text-gray-900">{dispute.resolution}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
