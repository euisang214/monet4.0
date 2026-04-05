'use client';

import { useState } from 'react';
import { useTrackedAdminActions } from '@/components/admin/hooks/useTrackedAdminActions';
import { Button } from '@/components/ui/primitives/Button';

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
    const [message, setMessage] = useState<string | null>(null);
    const { updateZoomLinks } = useTrackedAdminActions();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            if (!url.trim() && !candidateUrl.trim() && !professionalUrl.trim()) {
                throw new Error('Enter a shared URL or at least one role-specific URL');
            }

            await updateZoomLinks({
                bookingId,
                zoomJoinUrl: url.trim() || undefined,
                zoomMeetingId: meetingId.trim() || undefined,
                candidateZoomJoinUrl: candidateUrl.trim() || undefined,
                professionalZoomJoinUrl: professionalUrl.trim() || undefined,
            });
        } catch (submitError: unknown) {
            if (submitError instanceof Error && submitError.message === 'Enter a shared URL or at least one role-specific URL') {
                setMessage(submitError.message);
            }
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

            {message ? (
                <div className="p-2 rounded text-sm bg-red-100 text-red-700">
                    {message}
                </div>
            ) : null}

            <Button
                type="submit"
                disabled={loading}
                variant="primary"
            >
                {loading ? 'Updating...' : 'Update Zoom Link'}
            </Button>
        </form>
    );
}
