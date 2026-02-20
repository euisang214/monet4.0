'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ZoomLinkForm({
    bookingId,
    initialUrl,
    initialMeetingId,
    initialCandidateUrl,
    initialProfessionalUrl,
}: {
    bookingId: string;
    initialUrl?: string | null;
    initialMeetingId?: string | null;
    initialCandidateUrl?: string | null;
    initialProfessionalUrl?: string | null;
}) {
    const [url, setUrl] = useState(initialUrl || '');
    const [meetingId, setMeetingId] = useState(initialMeetingId || '');
    const [candidateUrl, setCandidateUrl] = useState(initialCandidateUrl || '');
    const [professionalUrl, setProfessionalUrl] = useState(initialProfessionalUrl || '');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const router = useRouter();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!url.trim() && !candidateUrl.trim() && !professionalUrl.trim()) {
                throw new Error('Enter a shared URL or at least one role-specific URL');
            }

            const res = await fetch(`/api/admin/bookings/${bookingId}/zoom-link`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    zoomJoinUrl: url.trim() || undefined,
                    zoomMeetingId: meetingId.trim() || undefined,
                    candidateZoomJoinUrl: candidateUrl.trim() || undefined,
                    professionalZoomJoinUrl: professionalUrl.trim() || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update');
            }

            setMessage({ type: 'success', text: 'Zoom link updated successfully' });
            router.refresh();
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded-lg border">
            <h3 className="font-semibold text-gray-900">Manual Zoom Link Override</h3>
            <p className="text-sm text-gray-500">Use this if automatic Zoom provisioning fails.</p>

            <div>
                <label className="block text-sm font-medium text-gray-700">Shared Zoom Join URL (Optional)</label>
                <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="https://zoom.us/j/..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Candidate Zoom Join URL (Optional)</label>
                <input
                    type="url"
                    value={candidateUrl}
                    onChange={(e) => setCandidateUrl(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="https://zoom.us/w/..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Professional Zoom Join URL (Optional)</label>
                <input
                    type="url"
                    value={professionalUrl}
                    onChange={(e) => setProfessionalUrl(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                    placeholder="https://zoom.us/w/..."
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Meeting ID (Optional)</label>
                <input
                    type="text"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                />
            </div>

            <p className="text-xs text-gray-500">
                Provide either a shared URL or one/both role-specific URLs.
            </p>

            {message && (
                <div className={`p-2 rounded text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
                {loading ? 'Updating...' : 'Update Zoom Link'}
            </button>
        </form>
    );
}
