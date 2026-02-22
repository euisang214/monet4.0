'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { appRoutes } from '@/lib/shared/routes';

export default function ReviewPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [rating, setRating] = useState(5);
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (text.length < 50) {
            setError('Review must be at least 50 characters long.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // POST /api/candidate/reviews
            // Body: { bookingId, rating (1-5), text (min 50 chars), timezone }
            const res = await fetch(appRoutes.api.candidate.reviews, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bookingId: params.id,
                    rating,
                    text,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit review');
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
            <h1 className="text-2xl font-bold mb-6">Leave a Review</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Rating</label>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className={`text-2xl focus:outline-none ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium mb-1">Review (min 50 chars)</label>
                    <textarea
                        className="w-full border rounded p-2"
                        rows={5}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Share your experience..."
                    />
                    <div className="text-right text-xs text-gray-500 mt-1">
                        {text.length} / 50 characters
                    </div>
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
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Submit Review' : 'Submit Review'}
                    </button>
                </div>
            </div>
        </div>
    );
}
