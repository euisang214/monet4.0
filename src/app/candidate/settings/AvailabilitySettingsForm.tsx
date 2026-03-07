'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { appRoutes } from '@/lib/shared/routes';
import { useTrackedRequest } from '@/components/ui/providers/RequestToastProvider';
import { executeTrackedAction } from '@/components/ui/actions/executeTrackedAction';
import { buildErrorToastCopy } from '@/components/ui/hooks/requestToastController';

interface Props {
    initialAvailability: Array<{
        start: Date | string;
        end: Date | string;
    }>;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
type DailySchedule = { enabled: boolean; start: string; end: string };
type WeeklySchedule = Record<number, DailySchedule>;

export function AvailabilitySettingsForm({ initialAvailability }: Props) {
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const trackedRuntime = {
        runTrackedRequest,
        push: router.push,
        replace: router.replace,
        refresh: router.refresh,
    };
    const [isLoading, setIsLoading] = useState(false);

    // Actually, let's just make a simple day toggle + time range for MVP
    // Mapping 0=Sun, 1=Mon... Prisma usually stores dayOfWeek as Int (0-6)

    const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
        const map: WeeklySchedule = {
            0: { enabled: false, start: '09:00', end: '17:00' },
            1: { enabled: false, start: '09:00', end: '17:00' },
            2: { enabled: false, start: '09:00', end: '17:00' },
            3: { enabled: false, start: '09:00', end: '17:00' },
            4: { enabled: false, start: '09:00', end: '17:00' },
            5: { enabled: false, start: '09:00', end: '17:00' },
            6: { enabled: false, start: '09:00', end: '17:00' },
        };
        // Init all days disabled

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

            await executeTrackedAction(trackedRuntime, {
                action: async () => {
                    const res = await fetch(appRoutes.api.candidate.availability, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ slots })
                    });

                    if (!res.ok) {
                        throw new Error('Failed to save');
                    }

                    return true;
                },
                copy: {
                    pending: {
                        title: 'Saving availability settings',
                        message: 'Generating the next four weeks of availability.',
                    },
                    success: {
                        title: 'Availability settings saved',
                        message: 'Your generated schedule is up to date.',
                    },
                    error: (error) => buildErrorToastCopy(error, 'Availability save failed'),
                },
                postSuccess: { kind: 'refresh' },
            });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
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
