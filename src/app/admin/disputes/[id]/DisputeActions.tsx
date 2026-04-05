'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/primitives/Button';

interface DisputeActionsProps {
    disputeId: string;
    currentStatus: string;
}

export function DisputeActions({ disputeId, currentStatus }: DisputeActionsProps) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    if (currentStatus === 'resolved') {
        return (
            <div className="bg-green-50 p-4 rounded text-green-800 border border-green-100">
                This dispute has been resolved.
            </div>
        )
    }

    async function handleResolve(action: 'full_refund' | 'dismiss', resolutionText: string) {
        if (!confirm(`Are you sure you want to ${action === 'full_refund' ? 'issue a full refund' : 'dismiss this dispute'}? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    resolution: resolutionText,
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to resolve dispute');
            }

            router.refresh();
        } catch (error) {
            alert('Error resolving dispute');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-white shadow rounded-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold border-b pb-2">Resolution Actions</h2>
            <div className="space-y-4">

                {/* Full Refund Option */}
                <div className="p-4 border rounded bg-gray-50">
                    <h3 className="font-medium text-gray-900">Issue Full Refund</h3>
                    <p className="text-sm text-gray-500 mb-2">Refunds the candidate and blocks payout to professional.</p>
                    <Button
                        type="button"
                        onClick={() => handleResolve('full_refund', 'Admin issued full refund.')}
                        disabled={loading}
                        variant="danger"
                        size="sm"
                    >
                        Issue Refund & Close
                    </Button>
                </div>

                {/* Dismiss Option */}
                <div className="p-4 border rounded bg-gray-50">
                    <h3 className="font-medium text-gray-900">Dismiss Dispute</h3>
                    <p className="text-sm text-gray-500 mb-2">Releases the payout to the professional.</p>
                    <Button
                        type="button"
                        onClick={() => handleResolve('dismiss', 'Admin dismissed dispute.')}
                        disabled={loading}
                        variant="secondary"
                        size="sm"
                    >
                        Dismiss & Release Payout
                    </Button>
                </div>
            </div>
        </div>
    );
}
