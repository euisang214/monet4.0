'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function ReschedulePage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [selectedDate, setSelectedDate] = useState<string>('');
    // In a real app, we'd fetch slots for the selected date from API
    // For MVP, we'll mock some slots or let user pick arbitrary times (simplified)
    // CLAUDE.md says: `POST /api/candidate/bookings/[id]/reschedule/request` body: `{ slots: TimeSlot[], reason?: string }`
    // And `available time slots are derived from the candidate's Availability table (synced from Google Calendar)`
    // Actually, for RESCHEDULING, we probably need to see PROFESSIONAL's availability?
    // CLAUDE.md says: `POST /api/candidate/bookings/[id]/reschedule/request`
    // logic: "Candidate requests reschedule (triggers candidate availability sync)"? 
    // No, usually you propose times based on YOUR availability or Pro's.
    // CLAUDE.md #1052: Pro requests reschedule.
    // CLAUDE.md #1104: Candidate requests reschedule.
    // "Only when status = accepted".
    // Let's assume Candidate proposes 3 slots they are free.

    const [slots, setSlots] = useState<{ start: Date; end: Date }[]>([]);
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddSlot = (dateString: string, time: string) => {
        if (!dateString) return;

        // Parse time (HH:mm)
        const [hours, minutes] = time.split(':').map(Number);
        // Create date from YYYY-MM-DD
        const [year, month, day] = dateString.split('-').map(Number);

        const start = new Date(year, month - 1, day);
        start.setHours(hours, minutes, 0, 0);

        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 30); // 30 min duration

        setSlots([...slots, { start, end }]);
    };

    const handleRemoveSlot = (index: number) => {
        setSlots(slots.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (slots.length === 0) {
            setError('Please propose at least one time slot.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/candidate/bookings/${params.id}/reschedule/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots, reason }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit reschedule request');
            }

            router.push(`/candidate/bookings/${params.id}`);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">Reschedule Booking</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-lg font-semibold mb-4">Propose New Times</h2>
                <p className="text-gray-600 mb-4 text-sm">
                    Please select dates and times you are available. Providing multiple options helps speed up the process.
                </p>

                <div className="flex flex-col md:flex-row gap-8">
                    <div>
                        <label className="block text-sm font-medium mb-1">Pick a Date</label>
                        <input
                            type="date"
                            min={new Date().toISOString().split('T')[0]}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="border rounded p-2 w-full"
                        />
                    </div>

                    <div className="flex-1">
                        {selectedDate ? (
                            <div>
                                <h3 className="font-medium mb-2">Select time for {selectedDate}:</h3>
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                                        <button
                                            key={time}
                                            onClick={() => handleAddSlot(selectedDate, time)}
                                            className="px-3 py-1 text-sm border rounded hover:bg-blue-50"
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-gray-500 h-full flex items-center justify-center border-2 border-dashed rounded bg-gray-50 p-4">
                                Select a date to see times
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 border-t pt-4">
                    <h3 className="font-medium mb-2">Proposed Slots:</h3>
                    {slots.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No slots added yet.</p>
                    ) : (
                        <ul className="space-y-2">
                            {slots.map((slot, idx) => (
                                <li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                                    <span>{format(slot.start, 'PPP p')} - {format(slot.end, 'p')}</span>
                                    <button onClick={() => handleRemoveSlot(idx)} className="text-red-500 hover:text-red-700 font-bold px-2">&times;</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-6">
                    <label className="block text-sm font-medium mb-1">Reason (Optional)</label>
                    <textarea
                        className="w-full border rounded p-2 text-sm"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Conflict with work meeting..."
                    />
                </div>

                {error && <div className="mt-4 text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={() => router.back()}
                        className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading || slots.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}
