'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DisputeReason } from '@prisma/client';
import { appRoutes } from '@/lib/shared/routes';

export default function DisputePage({ params }: { params: { id: string } }) {
    const router = useRouter();
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
            const res = await fetch(appRoutes.api.candidate.bookingDispute(params.id), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, description }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit dispute');
            }

            router.push(appRoutes.candidate.bookingDetails(params.id));
            router.refresh();
        } catch (err: any) {
            setError(err.message);
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
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Submitting...' : 'Submit Report'}
                    </button>
                </div>
            </div>
        </div>
    );
}
