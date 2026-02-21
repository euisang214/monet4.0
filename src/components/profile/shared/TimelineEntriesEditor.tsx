"use client";

import type { Dispatch, SetStateAction } from "react";
import {
    createEmptyExperienceEntry,
    ExperienceFormEntry,
    normalizeCurrentExperienceEntries,
} from "@/components/profile/shared/profileFormAdapters";

type TimelineEntriesEditorProps = {
    sectionTitle: string;
    sectionDescription: string;
    addLabel: string;
    entryLabelPrefix: string;
    titlePlaceholder: string;
    companyPlaceholder: string;
    currentLabel: string;
    entries: ExperienceFormEntry[];
    setEntries: Dispatch<SetStateAction<ExperienceFormEntry[]>>;
    enforceSingleCurrent?: boolean;
    disabled?: boolean;
};

function updateEntry(
    setter: Dispatch<SetStateAction<ExperienceFormEntry[]>>,
    index: number,
    field: keyof ExperienceFormEntry,
    value: string | boolean,
    enforceSingleCurrent: boolean
) {
    setter((prev) => {
        const mapped = prev.map((entry, currentIndex) => {
            if (currentIndex !== index) {
                if (enforceSingleCurrent && field === "isCurrent" && value === true) {
                    return {
                        ...entry,
                        isCurrent: false,
                    };
                }
                return entry;
            }

            const next = { ...entry, [field]: value } as ExperienceFormEntry;
            if (field === "isCurrent" && value === true) {
                next.endDate = "";
            }
            return next;
        });

        return enforceSingleCurrent ? normalizeCurrentExperienceEntries(mapped) : mapped;
    });
}

function removeEntry(
    setter: Dispatch<SetStateAction<ExperienceFormEntry[]>>,
    index: number,
    enforceSingleCurrent: boolean
) {
    setter((prev) => {
        if (prev.length <= 1) return prev;

        const next = prev.filter((_, currentIndex) => currentIndex !== index);

        if (enforceSingleCurrent) {
            return normalizeCurrentExperienceEntries(next);
        }

        return next;
    });
}

export function TimelineEntriesEditor({
    sectionTitle,
    sectionDescription,
    addLabel,
    entryLabelPrefix,
    titlePlaceholder,
    companyPlaceholder,
    currentLabel,
    entries,
    setEntries,
    enforceSingleCurrent = false,
    disabled = false,
}: TimelineEntriesEditorProps) {
    return (
        <section className="space-y-4 rounded-md border border-gray-200 p-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">{sectionTitle}</h2>
                    <p className="text-xs text-gray-500">{sectionDescription}</p>
                </div>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                        setEntries((prev) => [
                            ...prev,
                            {
                                ...createEmptyExperienceEntry(),
                                isCurrent: false,
                            },
                        ])
                    }
                    className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                    {addLabel}
                </button>
            </div>

            <div className="space-y-4">
                {entries.map((entry, index) => (
                    <article key={`${sectionTitle.toLowerCase()}-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">
                                {entryLabelPrefix} #{index + 1}
                            </h3>
                            <button
                                type="button"
                                disabled={disabled || entries.length <= 1}
                                onClick={() => removeEntry(setEntries, index, enforceSingleCurrent)}
                                className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-40"
                            >
                                Remove
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.title}
                                onChange={(event) =>
                                    updateEntry(setEntries, index, "title", event.target.value, enforceSingleCurrent)
                                }
                                className="w-full p-2 border rounded-md"
                                placeholder={titlePlaceholder}
                            />
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.company}
                                onChange={(event) =>
                                    updateEntry(setEntries, index, "company", event.target.value, enforceSingleCurrent)
                                }
                                className="w-full p-2 border rounded-md"
                                placeholder={companyPlaceholder}
                            />
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.location}
                                onChange={(event) =>
                                    updateEntry(setEntries, index, "location", event.target.value, enforceSingleCurrent)
                                }
                                className="w-full p-2 border rounded-md"
                                placeholder="Location (optional)"
                            />
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type={enforceSingleCurrent ? "radio" : "checkbox"}
                                    name={enforceSingleCurrent ? `${sectionTitle.toLowerCase()}-current` : undefined}
                                    disabled={disabled}
                                    checked={entry.isCurrent}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "isCurrent", event.target.checked, enforceSingleCurrent)
                                    }
                                />
                                {currentLabel}
                            </label>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Start date</p>
                                <input
                                    type="date"
                                    disabled={disabled}
                                    value={entry.startDate}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "startDate", event.target.value, enforceSingleCurrent)
                                    }
                                    className="w-full p-2 border rounded-md"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">End date</p>
                                <input
                                    type="date"
                                    disabled={disabled || entry.isCurrent}
                                    value={entry.endDate}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "endDate", event.target.value, enforceSingleCurrent)
                                    }
                                    className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                />
                            </div>
                        </div>

                        <textarea
                            disabled={disabled}
                            value={entry.description}
                            onChange={(event) =>
                                updateEntry(setEntries, index, "description", event.target.value, enforceSingleCurrent)
                            }
                            className="w-full p-2 border rounded-md h-20"
                            placeholder="Description (optional)"
                        />
                    </article>
                ))}
            </div>
        </section>
    );
}
