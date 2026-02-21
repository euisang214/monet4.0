"use client";

import type { Dispatch, SetStateAction } from "react";
import {
    createEmptyEducationEntry,
    EducationFormEntry,
} from "@/components/profile/shared/profileFormAdapters";

type EducationEntriesEditorProps = {
    entries: EducationFormEntry[];
    setEntries: Dispatch<SetStateAction<EducationFormEntry[]>>;
    disabled?: boolean;
};

function updateEntry(
    setter: Dispatch<SetStateAction<EducationFormEntry[]>>,
    index: number,
    field: keyof EducationFormEntry,
    value: string | boolean
) {
    setter((prev) =>
        prev.map((entry, currentIndex) => {
            if (currentIndex !== index) return entry;
            const next = { ...entry, [field]: value } as EducationFormEntry;
            if (field === "isCurrent" && value === true) {
                next.endDate = "";
            }
            return next;
        })
    );
}

export function EducationEntriesEditor({
    entries,
    setEntries,
    disabled = false,
}: EducationEntriesEditorProps) {
    return (
        <section className="space-y-4 rounded-md border border-gray-200 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Education</h2>
                    <p className="text-xs text-gray-500">Add one or more education entries.</p>
                </div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setEntries((prev) => [...prev, createEmptyEducationEntry()])}
                    className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                    Add education
                </button>
            </div>

            <div className="space-y-4">
                {entries.map((entry, index) => (
                    <article key={`education-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">Education #{index + 1}</h3>
                            <button
                                type="button"
                                disabled={disabled || entries.length <= 1}
                                onClick={() =>
                                    setEntries((prev) =>
                                        prev.length > 1
                                            ? prev.filter((_, currentIndex) => currentIndex !== index)
                                            : prev
                                    )
                                }
                                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                            >
                                Remove
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.school}
                                onChange={(event) => updateEntry(setEntries, index, "school", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="School"
                            />
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.degree}
                                onChange={(event) => updateEntry(setEntries, index, "degree", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Degree"
                            />
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.fieldOfStudy}
                                onChange={(event) => updateEntry(setEntries, index, "fieldOfStudy", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Field of study"
                            />
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.location}
                                onChange={(event) => updateEntry(setEntries, index, "location", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Location (optional)"
                            />
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Start date</p>
                                <input
                                    type="date"
                                    disabled={disabled}
                                    value={entry.startDate}
                                    onChange={(event) => updateEntry(setEntries, index, "startDate", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">End date</p>
                                <input
                                    type="date"
                                    disabled={disabled || entry.isCurrent}
                                    value={entry.endDate}
                                    onChange={(event) => updateEntry(setEntries, index, "endDate", event.target.value)}
                                    className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                />
                            </div>
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    disabled={disabled}
                                    checked={entry.isCurrent}
                                    onChange={(event) => updateEntry(setEntries, index, "isCurrent", event.target.checked)}
                                />
                                Currently studying here
                            </label>
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.gpa}
                                onChange={(event) => updateEntry(setEntries, index, "gpa", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="GPA (optional)"
                            />
                        </div>

                        <input
                            type="text"
                            disabled={disabled}
                            value={entry.honors}
                            onChange={(event) => updateEntry(setEntries, index, "honors", event.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="Honors (optional)"
                        />
                        <input
                            type="text"
                            disabled={disabled}
                            value={entry.activities}
                            onChange={(event) => updateEntry(setEntries, index, "activities", event.target.value)}
                            className="w-full p-2 border rounded-md"
                            placeholder="Education activities (comma separated, optional)"
                        />
                    </article>
                ))}
            </div>
        </section>
    );
}
