"use client";

import type { Dispatch, SetStateAction } from "react";
import {
    createEmptyEducationEntry,
    createEmptyExperienceEntry,
    EducationFormEntry,
    ExperienceFormEntry,
    normalizeCurrentExperienceEntries,
} from "@/components/profile/timeline-form";

type TimelineSectionsEditorProps = {
    experienceEntries: ExperienceFormEntry[];
    setExperienceEntries: Dispatch<SetStateAction<ExperienceFormEntry[]>>;
    activityEntries: ExperienceFormEntry[];
    setActivityEntries: Dispatch<SetStateAction<ExperienceFormEntry[]>>;
    educationEntries: EducationFormEntry[];
    setEducationEntries: Dispatch<SetStateAction<EducationFormEntry[]>>;
    enforceSingleCurrentExperience?: boolean;
    disabled?: boolean;
};

function updateExperienceEntry(
    setter: Dispatch<SetStateAction<ExperienceFormEntry[]>>,
    index: number,
    field: keyof ExperienceFormEntry,
    value: string | boolean,
    enforceSingleCurrentExperience: boolean
) {
    setter((prev) => {
        const mapped = prev.map((entry, currentIndex) => {
            if (currentIndex !== index) {
                if (enforceSingleCurrentExperience && field === "isCurrent" && value === true) {
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

        return enforceSingleCurrentExperience ? normalizeCurrentExperienceEntries(mapped) : mapped;
    });
}

function updateEducationEntry(
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

function removeExperienceEntry(
    setter: Dispatch<SetStateAction<ExperienceFormEntry[]>>,
    index: number,
    enforceSingleCurrentExperience: boolean
) {
    setter((prev) => {
        if (prev.length <= 1) return prev;

        const next = prev.filter((_, currentIndex) => currentIndex !== index);

        if (enforceSingleCurrentExperience) {
            return normalizeCurrentExperienceEntries(next);
        }

        return next;
    });
}

export function TimelineSectionsEditor({
    experienceEntries,
    setExperienceEntries,
    activityEntries,
    setActivityEntries,
    educationEntries,
    setEducationEntries,
    enforceSingleCurrentExperience = false,
    disabled = false,
}: TimelineSectionsEditorProps) {
    return (
        <>
            <section className="space-y-4 rounded-md border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Experience</h2>
                        <p className="text-xs text-gray-500">
                            {enforceSingleCurrentExperience
                                ? "Add one or more experience entries. Select exactly one current role."
                                : "Add one or more experience entries."}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                            setExperienceEntries((prev) => [
                                ...prev,
                                {
                                    ...createEmptyExperienceEntry(),
                                    isCurrent: false,
                                },
                            ])
                        }
                        className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                        Add experience
                    </button>
                </div>

                <div className="space-y-4">
                    {experienceEntries.map((entry, index) => (
                        <article key={`experience-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">Experience #{index + 1}</h3>
                                <button
                                    type="button"
                                    disabled={disabled || experienceEntries.length <= 1}
                                    onClick={() =>
                                        removeExperienceEntry(
                                            setExperienceEntries,
                                            index,
                                            enforceSingleCurrentExperience
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
                                    value={entry.title}
                                    onChange={(event) =>
                                        updateExperienceEntry(
                                            setExperienceEntries,
                                            index,
                                            "title",
                                            event.target.value,
                                            enforceSingleCurrentExperience
                                        )
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Title"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.company}
                                    onChange={(event) =>
                                        updateExperienceEntry(
                                            setExperienceEntries,
                                            index,
                                            "company",
                                            event.target.value,
                                            enforceSingleCurrentExperience
                                        )
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Company"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.location}
                                    onChange={(event) =>
                                        updateExperienceEntry(
                                            setExperienceEntries,
                                            index,
                                            "location",
                                            event.target.value,
                                            enforceSingleCurrentExperience
                                        )
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Location (optional)"
                                />
                                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type={enforceSingleCurrentExperience ? "radio" : "checkbox"}
                                        name={enforceSingleCurrentExperience ? "professional-current-role" : undefined}
                                        disabled={disabled}
                                        checked={entry.isCurrent}
                                        onChange={(event) =>
                                            updateExperienceEntry(
                                                setExperienceEntries,
                                                index,
                                                "isCurrent",
                                                event.target.checked,
                                                enforceSingleCurrentExperience
                                            )
                                        }
                                    />
                                    {enforceSingleCurrentExperience ? "Current role" : "Current role"}
                                </label>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Start date</p>
                                    <input
                                        type="date"
                                        disabled={disabled}
                                        value={entry.startDate}
                                        onChange={(event) =>
                                            updateExperienceEntry(
                                                setExperienceEntries,
                                                index,
                                                "startDate",
                                                event.target.value,
                                                enforceSingleCurrentExperience
                                            )
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
                                            updateExperienceEntry(
                                                setExperienceEntries,
                                                index,
                                                "endDate",
                                                event.target.value,
                                                enforceSingleCurrentExperience
                                            )
                                        }
                                        className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                    />
                                </div>
                            </div>

                            <textarea
                                disabled={disabled}
                                value={entry.description}
                                onChange={(event) =>
                                    updateExperienceEntry(
                                        setExperienceEntries,
                                        index,
                                        "description",
                                        event.target.value,
                                        enforceSingleCurrentExperience
                                    )
                                }
                                className="w-full p-2 border rounded-md h-20"
                                placeholder="Description (optional)"
                            />
                        </article>
                    ))}
                </div>
            </section>

            <section className="space-y-4 rounded-md border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Activities</h2>
                        <p className="text-xs text-gray-500">Add one or more activity entries.</p>
                    </div>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setActivityEntries((prev) => [...prev, createEmptyExperienceEntry()])}
                        className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                        Add activity
                    </button>
                </div>

                <div className="space-y-4">
                    {activityEntries.map((entry, index) => (
                        <article key={`activity-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">Activity #{index + 1}</h3>
                                <button
                                    type="button"
                                    disabled={disabled || activityEntries.length <= 1}
                                    onClick={() => removeExperienceEntry(setActivityEntries, index, false)}
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
                                        updateExperienceEntry(setActivityEntries, index, "title", event.target.value, false)
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Role / activity title"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.company}
                                    onChange={(event) =>
                                        updateExperienceEntry(setActivityEntries, index, "company", event.target.value, false)
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Organization"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.location}
                                    onChange={(event) =>
                                        updateExperienceEntry(setActivityEntries, index, "location", event.target.value, false)
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Location (optional)"
                                />
                                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        disabled={disabled}
                                        checked={entry.isCurrent}
                                        onChange={(event) =>
                                            updateExperienceEntry(setActivityEntries, index, "isCurrent", event.target.checked, false)
                                        }
                                    />
                                    Ongoing activity
                                </label>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Start date</p>
                                    <input
                                        type="date"
                                        disabled={disabled}
                                        value={entry.startDate}
                                        onChange={(event) =>
                                            updateExperienceEntry(setActivityEntries, index, "startDate", event.target.value, false)
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
                                            updateExperienceEntry(setActivityEntries, index, "endDate", event.target.value, false)
                                        }
                                        className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                    />
                                </div>
                            </div>

                            <textarea
                                disabled={disabled}
                                value={entry.description}
                                onChange={(event) =>
                                    updateExperienceEntry(setActivityEntries, index, "description", event.target.value, false)
                                }
                                className="w-full p-2 border rounded-md h-20"
                                placeholder="Description (optional)"
                            />
                        </article>
                    ))}
                </div>
            </section>

            <section className="space-y-4 rounded-md border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Education</h2>
                        <p className="text-xs text-gray-500">Add one or more education entries.</p>
                    </div>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setEducationEntries((prev) => [...prev, createEmptyEducationEntry()])}
                        className="rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                        Add education
                    </button>
                </div>

                <div className="space-y-4">
                    {educationEntries.map((entry, index) => (
                        <article key={`education-${index}`} className="rounded-md border border-gray-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">Education #{index + 1}</h3>
                                <button
                                    type="button"
                                    disabled={disabled || educationEntries.length <= 1}
                                    onClick={() =>
                                        setEducationEntries((prev) =>
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
                                    onChange={(event) => updateEducationEntry(setEducationEntries, index, "school", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="School"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.degree}
                                    onChange={(event) => updateEducationEntry(setEducationEntries, index, "degree", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Degree"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.fieldOfStudy}
                                    onChange={(event) =>
                                        updateEducationEntry(setEducationEntries, index, "fieldOfStudy", event.target.value)
                                    }
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Field of study"
                                />
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.location}
                                    onChange={(event) => updateEducationEntry(setEducationEntries, index, "location", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="Location (optional)"
                                />
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Start date</p>
                                    <input
                                        type="date"
                                        disabled={disabled}
                                        value={entry.startDate}
                                        onChange={(event) => updateEducationEntry(setEducationEntries, index, "startDate", event.target.value)}
                                        className="w-full p-2 border rounded-md"
                                    />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">End date</p>
                                    <input
                                        type="date"
                                        disabled={disabled || entry.isCurrent}
                                        value={entry.endDate}
                                        onChange={(event) => updateEducationEntry(setEducationEntries, index, "endDate", event.target.value)}
                                        className="w-full p-2 border rounded-md disabled:bg-gray-50"
                                    />
                                </div>
                                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        disabled={disabled}
                                        checked={entry.isCurrent}
                                        onChange={(event) =>
                                            updateEducationEntry(setEducationEntries, index, "isCurrent", event.target.checked)
                                        }
                                    />
                                    Currently studying here
                                </label>
                                <input
                                    type="text"
                                    disabled={disabled}
                                    value={entry.gpa}
                                    onChange={(event) => updateEducationEntry(setEducationEntries, index, "gpa", event.target.value)}
                                    className="w-full p-2 border rounded-md"
                                    placeholder="GPA (optional)"
                                />
                            </div>

                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.honors}
                                onChange={(event) => updateEducationEntry(setEducationEntries, index, "honors", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Honors (optional)"
                            />
                            <input
                                type="text"
                                disabled={disabled}
                                value={entry.activities}
                                onChange={(event) => updateEducationEntry(setEducationEntries, index, "activities", event.target.value)}
                                className="w-full p-2 border rounded-md"
                                placeholder="Education activities (comma separated, optional)"
                            />
                        </article>
                    ))}
                </div>
            </section>
        </>
    );
}
