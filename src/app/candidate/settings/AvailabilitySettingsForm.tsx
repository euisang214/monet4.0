'use client';

import React, { useState } from 'react';
import { Availability } from '@prisma/client';
import { useRouter } from 'next/navigation';

interface Props {
    initialAvailability: Availability[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function AvailabilitySettingsForm({ initialAvailability }: Props) {
    const router = useRouter();
    const [availability, setAvailability] = useState<Availability[]>(initialAvailability);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleTimeChange = (index: number, field: 'startTime' | 'endTime', value: string) => {
        const newAvail = [...availability];
        // Simple update logic - in real app, might fetch by ID or day index
        // Here we assume we are editing a list. 
        // BUT, Prisma returns an array. If we want to Add/Remove days... simpler UI needed.

        // Simplified: Just 9-5 defaults toggle? Or text inputs?
        // Let's assume text inputs for now.
        // TODO: Strict UI

        (newAvail[index] as any)[field] = value;
        setAvailability(newAvail);
    };

    // Actually, let's just make a simple day toggle + time range for MVP
    // Mapping 0=Sun, 1=Mon... Prisma usually stores dayOfWeek as Int (0-6)

    const [schedule, setSchedule] = useState<{ [key: number]: { enabled: boolean, start: string, end: string } }>(() => {
        const map: any = {};
        // Init all days disabled
        [0, 1, 2, 3, 4, 5, 6].forEach(d => map[d] = { enabled: false, start: '09:00', end: '17:00' });

        // Fill from initial (simplified: take first occurrence of a day to determine rules)
        initialAvailability.forEach(a => {
            const day = new Date(a.start).getDay();
            // Extract HH:MM
            const s = new Date(a.start).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            const e = new Date(a.end).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            map[day] = { enabled: true, start: s, end: e };
        });
        return map;
    });

    const handleToggle = (day: number) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled }
        }));
    };

    const handleChange = (day: number, field: 'start' | 'end', val: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: val }
        }));
    };

    const save = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            // Generate slots for next 4 weeks based on schedule
            const slots: { start: Date, end: Date }[] = [];
            const now = new Date();
            // Start from tomorrow? or today?
            const cursor = new Date(now);
            cursor.setHours(0, 0, 0, 0);

            for (let i = 0; i < 28; i++) { // 4 weeks
                const dayOfWeek = cursor.getDay();
                const rule = schedule[dayOfWeek];

                if (rule && rule.enabled) {
                    const [sh, sm] = rule.start.split(':').map(Number);
                    const [eh, em] = rule.end.split(':').map(Number);

                    const slotStart = new Date(cursor);
                    slotStart.setHours(sh, sm, 0, 0);

                    const slotEnd = new Date(cursor);
                    slotEnd.setHours(eh, em, 0, 0);

                    slots.push({ start: slotStart, end: slotEnd });
                }

                // Next day
                cursor.setDate(cursor.getDate() + 1);
            }

            const res = await fetch('/api/candidate/availability', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots })
            });

            if (!res.ok) throw new Error('Failed to save');

            setMessage('Settings saved successfully (generated for next 4 weeks)');
            router.refresh();
        } catch (e) {
            setMessage('Error saving settings');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            {message && <div className={`p-4 mb-4 rounded ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{message}</div>}

            <div className="space-y-4">
                {DAYS.map((dayName, idx) => {
                    // Adjust index to match 0=Sunday if desired, or 1=Monday. 
                    // Date.getDay() 0=Sunday. Let's stick to standard 0=Sunday, 1=Monday...
                    // DAYS array is Mon-Sun (Indices 0-6 in UI list). 
                    // Check Prisma/TS convention. Usually 0=Sunday.
                    // Let's say Mon(1) ... Sat(6), Sun(0).
                    const dayInt = idx + 1 > 6 ? 0 : idx + 1;

                    const dayState = schedule[dayInt];

                    return (
                        <div key={dayInt} className="flex items-center gap-4 border-b pb-4 last:border-0">
                            <div className="w-24">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={dayState.enabled}
                                        onChange={() => handleToggle(dayInt)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="font-medium text-gray-700">{dayName}</span>
                                </label>
                            </div>

                            {dayState.enabled ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="time"
                                        value={dayState.start}
                                        onChange={(e) => handleChange(dayInt, 'start', e.target.value)}
                                        className="border rounded p-1 text-sm"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="time"
                                        value={dayState.end}
                                        onChange={(e) => handleChange(dayInt, 'end', e.target.value)}
                                        className="border rounded p-1 text-sm"
                                    />
                                </div>
                            ) : (
                                <span className="text-sm text-gray-400 italic">Unavailable</span>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="mt-8">
                <button
                    onClick={save}
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
