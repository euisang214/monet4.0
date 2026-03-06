"use client";

import type { Dispatch, SetStateAction } from "react";
import {
    createEmptyExperienceEntry,
    ExperienceFormEntry,
    normalizeCurrentExperienceEntries,
} from "@/components/profile/shared/profileFormAdapters";
import {
    Button,
    ChoiceInput,
    ChoiceLabel,
    Field,
    FormSection,
    SurfaceCard,
    TextAreaInput,
    TextInput,
} from "@/components/ui";

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
    const sectionKey = sectionTitle.toLowerCase().replace(/\s+/g, "-");

    return (
        <FormSection
            title={sectionTitle}
            description={sectionDescription}
            actions={
                <Button
                    type="button"
                    variant="secondary"
                    size="sm"
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
                >
                    {addLabel}
                </Button>
            }
        >
            <div className="space-y-4">
                {entries.map((entry, index) => (
                    <SurfaceCard key={`${sectionKey}-${index}`} as="article" tone="muted" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-900">
                                {entryLabelPrefix} #{index + 1}
                            </h3>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={disabled || entries.length <= 1}
                                onClick={() => removeEntry(setEntries, index, enforceSingleCurrent)}
                            >
                                Remove
                            </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Title" htmlFor={`${sectionKey}-title-${index}`}>
                                <TextInput
                                    id={`${sectionKey}-title-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.title}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "title", event.target.value, enforceSingleCurrent)
                                    }
                                    placeholder={titlePlaceholder}
                                />
                            </Field>
                            <Field label="Company" htmlFor={`${sectionKey}-company-${index}`}>
                                <TextInput
                                    id={`${sectionKey}-company-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.company}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "company", event.target.value, enforceSingleCurrent)
                                    }
                                    placeholder={companyPlaceholder}
                                />
                            </Field>
                            <Field label="Location" htmlFor={`${sectionKey}-location-${index}`}>
                                <TextInput
                                    id={`${sectionKey}-location-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    value={entry.location}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "location", event.target.value, enforceSingleCurrent)
                                    }
                                    placeholder="Location (optional)"
                                />
                            </Field>
                            <Field label="Status">
                                <ChoiceLabel>
                                    <ChoiceInput
                                        type={enforceSingleCurrent ? "radio" : "checkbox"}
                                        name={enforceSingleCurrent ? `${sectionKey}-current` : undefined}
                                        disabled={disabled}
                                        checked={entry.isCurrent}
                                        onChange={(event) =>
                                            updateEntry(setEntries, index, "isCurrent", event.target.checked, enforceSingleCurrent)
                                        }
                                    />
                                    {currentLabel}
                                </ChoiceLabel>
                            </Field>
                            <Field label="Start date" htmlFor={`${sectionKey}-start-${index}`}>
                                <TextInput
                                    id={`${sectionKey}-start-${index}`}
                                    type="date"
                                    disabled={disabled}
                                    value={entry.startDate}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "startDate", event.target.value, enforceSingleCurrent)
                                    }
                                />
                            </Field>
                            <Field label="End date" htmlFor={`${sectionKey}-end-${index}`}>
                                <TextInput
                                    id={`${sectionKey}-end-${index}`}
                                    type="date"
                                    disabled={disabled || entry.isCurrent}
                                    value={entry.endDate}
                                    onChange={(event) =>
                                        updateEntry(setEntries, index, "endDate", event.target.value, enforceSingleCurrent)
                                    }
                                />
                            </Field>
                        </div>

                        <Field
                            label="Description"
                            htmlFor={`${sectionKey}-description-${index}`}
                            hint="Keep this concise. Candidates mostly need context and outcomes."
                        >
                            <TextAreaInput
                                id={`${sectionKey}-description-${index}`}
                                disabled={disabled}
                                value={entry.description}
                                onChange={(event) =>
                                    updateEntry(setEntries, index, "description", event.target.value, enforceSingleCurrent)
                                }
                                rows={3}
                                autoResize
                                placeholder="Description (optional)"
                            />
                        </Field>
                    </SurfaceCard>
                ))}
            </div>
        </FormSection>
    );
}
