
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DisputeResolutionFormProps {
    disputeId: string;
    maxRefundAmount: number; // Cents
}

export default function DisputeResolutionForm({ disputeId, maxRefundAmount }: DisputeResolutionFormProps) {
    const router = useRouter();
    const [action, setAction] = useState<'dismiss' | 'full_refund' | 'partial_refund'>('dismiss');
    const [resolution, setResolution] = useState('');
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const body: any = {
                action,
                resolution,
            };

            if (action === 'partial_refund') {
                const cents = Math.round(parseFloat(refundAmount) * 100);
                if (isNaN(cents) || cents <= 0) {
                    throw new Error('Invalid refund amount');
                }
                body.refundAmountCents = cents;
            }

            const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to resolve dispute');
            }

            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Resolve Dispute</h3>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                    <p className="text-sm text-red-700">{error}</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700">Action</label>
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value as any)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    <option value="dismiss">Dismiss (Pay Professional)</option>
                    <option value="full_refund">Full Refund to Candidate</option>
                    <option value="partial_refund">Partial Refund</option>
                </select>
            </div>

            {action === 'partial_refund' && (
                <div>
                    <label className="block text-sm font-medium text-gray-700">Refund Amount ($)</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                            type="number"
                            step="0.01"
                            max={maxRefundAmount / 100}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00"
                        />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Max refundable: ${(maxRefundAmount / 100).toFixed(2)}</p>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700">Resolution Notes</label>
                <textarea
                    required
                    rows={3}
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 mt-1 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Explain the resolution..."
                />
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
                {isSubmitting ? 'Resolving...' : 'Resolve Dispute'}
            </button>
        </form>
    );
}
