"use client";

import type { Dispatch, SetStateAction } from "react";
import {
    createEmptyEducationEntry,
    EducationFormEntry,
} from "@/components/profile/shared/profileFormAdapters";
import {
    Button,
    ChoiceInput,
    ChoiceLabel,
    Field,
    FormSection,
    SurfaceCard,
    TextInput,
} from "@/components/ui";

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
        <FormSection
            title="Education"
            description="Add one or more education entries."
            actions={
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={disabled}
                    onClick={() => setEntries((prev) => [...prev, createEmptyEducationEntry()])}
                >
                    Add education
                </Button>
            }
        >
            <div className="space-y-4">
                {entries.map((entry, index) => (
                    <SurfaceCard key={`education-${index}`} as="article" tone="muted" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">Education #{index + 1}</h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={disabled || entries.length <= 1}
                                onClick={() =>
                                    setEntries((prev) =>
                                        prev.length > 1
                                            ? prev.filter((_, currentIndex) => currentIndex !== index)
                                            : prev
                                    )
                                }
                            >
                                Remove
                            </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="School" htmlFor={`education-school-${index}`}>
                                <TextInput
                                    id={`education-school-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.school}
                                    onChange={(event) => updateEntry(setEntries, index, "school", event.target.value)}
                                    placeholder="School"
                                />
                            </Field>
                            <Field label="Degree" htmlFor={`education-degree-${index}`}>
                                <TextInput
                                    id={`education-degree-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.degree}
                                    onChange={(event) => updateEntry(setEntries, index, "degree", event.target.value)}
                                    placeholder="Degree"
                                />
                            </Field>
                            <Field label="Field of study" htmlFor={`education-field-${index}`}>
                                <TextInput
                                    id={`education-field-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.fieldOfStudy}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "fieldOfStudy", event.target.value)
                                    }
                                    placeholder="Field of study"
                                />
                            </Field>
                            <Field label="Location" htmlFor={`education-location-${index}`}>
                                <TextInput
                                    id={`education-location-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.location}
                                    onChange={(event) => updateEntry(setEntries, index, "location", event.target.value)}
                                    placeholder="Location (optional)"
                                />
                            </Field>
                            <Field label="Start date" htmlFor={`education-start-${index}`}>
                                <TextInput
                                    id={`education-start-${index}`}
                                    type="date"
                                    disabled={disabled}
                                    value={entry.startDate}
                                    onChange={(event) => updateEntry(setEntries, index, "startDate", event.target.value)}
                                />
                            </Field>
                            <Field label="End date" htmlFor={`education-end-${index}`}>
                                <TextInput
                                    id={`education-end-${index}`}
                                    type="date"
                                    disabled={disabled || entry.isCurrent}
                                    value={entry.endDate}
                                    onChange={(event) => updateEntry(setEntries, index, "endDate", event.target.value)}
                                />
                            </Field>
                            <Field label="Status">
                                <ChoiceLabel>
                                    <ChoiceInput
                                        type="checkbox"
                                        disabled={disabled}
                                        checked={entry.isCurrent}
                                        onChange={(event) => updateEntry(setEntries, index, "isCurrent", event.target.checked)}
                                    />
                                    Currently studying here
                                </ChoiceLabel>
                            </Field>
                            <Field label="GPA" htmlFor={`education-gpa-${index}`}>
                                <TextInput
                                    id={`education-gpa-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.gpa}
                                    onChange={(event) => updateEntry(setEntries, index, "gpa", event.target.value)}
                                    placeholder="GPA (optional)"
                                />
                            </Field>
                        </div>

                        <Field label="Honors" htmlFor={`education-honors-${index}`}>
                            <TextInput
                                id={`education-honors-${index}`}
                                type="text"
                                disabled={disabled}
                                value={entry.honors}
                                onChange={(event) => updateEntry(setEntries, index, "honors", event.target.value)}
                                placeholder="Honors (optional)"
                            />
                        </Field>
                        <Field label="Activities" htmlFor={`education-activities-${index}`}>
                            <TextInput
                                id={`education-activities-${index}`}
                                type="text"
                                disabled={disabled}
                                value={entry.activities}
                                onChange={(event) => updateEntry(setEntries, index, "activities", event.target.value)}
                                placeholder="Education activities (comma separated, optional)"
                            />
                        </Field>
                    </SurfaceCard>
                ))}
            </div>
        </FormSection>
    );
}
