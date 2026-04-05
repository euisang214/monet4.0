'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DisputeReason } from '@prisma/client';
import { useTrackedCandidateBookingActions } from '@/components/bookings/hooks/useTrackedCandidateBookingActions';
import { Button } from '@/components/ui/primitives/Button';

export default function DisputePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { submitDispute } = useTrackedCandidateBookingActions();
    const [reason, setReason] = useState<DisputeReason | ''>('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!reason || !description) {
            setError('Please provide a reason and description.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await submitDispute({
                bookingId: id,
                reason,
                description,
            });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">Report an Issue</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Reason</label>
                    <select
                        value={reason}
                        onChange={(e) => setReason(e.target.value as DisputeReason)}
                        className="w-full border rounded p-2"
                    >
                        <option value="">Select a reason</option>
                        <option value="professional_no_show">Professional No-Show</option>
                        <option value="quality_issue">Quality Issue</option>
                        <option value="inappropriate_behavior">Inappropriate Behavior</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                        className="w-full border rounded p-2"
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Please describe the issue in detail..."
                    />
                </div>

                {error && <div className="mb-4 text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

                <div className="flex gap-3">
                    <Button
                        type="button"
                        onClick={() => router.back()}
                        variant="secondary"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isLoading}
                        variant="danger"
                    >
                        {isLoading ? 'Submitting...' : 'Submit Report'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
