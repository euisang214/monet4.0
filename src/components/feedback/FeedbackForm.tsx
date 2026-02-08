'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/primitives/Button';

interface FeedbackFormProps {
    bookingId: string;
    initialData?: {
        text?: string;
        actions?: string[];
    };
}

export function FeedbackForm({ bookingId, initialData }: FeedbackFormProps) {
    const router = useRouter();
    const [text, setText] = useState(initialData?.text || '');
    const [actions, setActions] = useState<string[]>(initialData?.actions?.length === 3 ? initialData.actions : ['', '', '']);
    const [ratings, setRatings] = useState({
        content: 5,
        delivery: 5,
        value: 5
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const isTextValid = wordCount >= 200;
    const areActionsValid = actions.every(a => a.trim().length > 0) && actions.length === 3;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!isTextValid || !areActionsValid) {
            setError('Please ensure you meet the word count (200) and provide 3 action items.');
            return;
        }

        try {
            setIsSubmitting(true);
            const res = await fetch(`/api/professional/feedback/${bookingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    actions,
                    contentRating: Number(ratings.content),
                    deliveryRating: Number(ratings.delivery),
                    valueRating: Number(ratings.value)
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to submit feedback');
            }

            // Success
            router.push('/professional/dashboard');
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const updateAction = (index: number, value: string) => {
        const newActions = [...actions];
        newActions[index] = value;
        setActions(newActions);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-md text-sm">
                    {error}
                </div>
            )}

            {/* Detailed Feedback */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Detailed Feedback (Minimum 200 words)
                </label>
                <div className="relative">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={12}
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border"
                        placeholder="Provide comprehensive feedback..."
                    />
                    <div className={`absolute bottom-3 right-3 text-xs ${isTextValid ? 'text-green-600' : 'text-red-500'}`}>
                        {wordCount} / 200 words
                    </div>
                </div>
            </div>

            {/* Action Items */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action Items (Exactly 3)
                </label>
                <div className="space-y-3">
                    {actions.map((action, idx) => (
                        <input
                            key={idx}
                            type="text"
                            value={action}
                            onChange={(e) => updateAction(idx, e.target.value)}
                            placeholder={`Action item ${idx + 1}`}
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                        />
                    ))}
                </div>
            </div>

            {/* Ratings */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                    Ratings (1-5 Stars)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <RatingInput label="Content Quality" value={ratings.content} onChange={v => setRatings(r => ({ ...r, content: v }))} />
                    <RatingInput label="Delivery" value={ratings.delivery} onChange={v => setRatings(r => ({ ...r, delivery: v }))} />
                    <RatingInput label="Value" value={ratings.value} onChange={v => setRatings(r => ({ ...r, value: v }))} />
                </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
                <Button
                    type="submit"
                    disabled={!isTextValid || !areActionsValid || isSubmitting}
                    className={`bg-blue-600 text-white px-6 py-2 rounded-md font-medium shadow-sm transition-colors ${(!isTextValid || !areActionsValid || isSubmitting) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                >
                    {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Button>
            </div>
        </form>
    );
}

function RatingInput({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) {
    return (
        <div>
            <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</div>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${star <= value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                    >
                        {star}
                    </button>
                ))}
            </div>
        </div>
    );
}
