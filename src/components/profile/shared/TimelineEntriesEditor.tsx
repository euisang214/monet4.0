"use client";

import {
    useFieldArray,
    useWatch,
    type Control,
    type FieldErrors,
    type UseFormRegister,
    type UseFormSetValue,
} from "react-hook-form";
import { normalizeCurrentExperienceEntries, type ExperienceFormEntry } from "@/components/profile/shared/profileFormAdapters";
import { getTimelineDefaultEntry } from "@/components/profile/shared/profileEditorSchemas";
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
    name: "experience" | "activities";
    sectionTitle: string;
    sectionDescription: string;
    addLabel: string;
    entryLabelPrefix: string;
    titlePlaceholder: string;
    companyPlaceholder: string;
    currentLabel: string;
    control: Control<any>;
    register: UseFormRegister<any>;
    setValue: UseFormSetValue<any>;
    errors?: FieldErrors<any>;
    enforceSingleCurrent?: boolean;
    disabled?: boolean;
};

function getEntryError(
    errors: FieldErrors<any> | undefined,
    sectionName: "experience" | "activities",
    index: number,
    field: keyof ExperienceFormEntry,
) {
    const maybeFieldError = errors?.[sectionName];
    if (!Array.isArray(maybeFieldError)) {
        return undefined;
    }

    const message = maybeFieldError[index]?.[field]?.message;
    return typeof message === "string" ? message : undefined;
}

function toExperienceFormEntry(entry: Partial<ExperienceFormEntry> | undefined): ExperienceFormEntry {
    return {
        company: entry?.company || "",
        title: entry?.title || "",
        location: entry?.location || "",
        startDate: entry?.startDate || "",
        endDate: entry?.endDate || "",
        isCurrent: entry?.isCurrent === true,
        description: entry?.description || "",
    };
}

function getTimelineEntries(entries: Partial<ExperienceFormEntry>[] | undefined) {
    return entries?.map((entry) => toExperienceFormEntry(entry)) || [];
}

export function TimelineEntriesEditor({
    name,
    sectionTitle,
    sectionDescription,
    addLabel,
    entryLabelPrefix,
    titlePlaceholder,
    companyPlaceholder,
    currentLabel,
    control,
    register,
    setValue,
    errors,
    enforceSingleCurrent = false,
    disabled = false,
}: TimelineEntriesEditorProps) {
    const sectionKey = sectionTitle.toLowerCase().replace(/\s+/g, "-");
    const { fields, append, remove, replace } = useFieldArray({
        control,
        name,
    });
    const watchedEntries = useWatch({
        control,
        name,
    }) as ExperienceFormEntry[] | undefined;

    const handleCurrentToggle = (index: number, checked: boolean) => {
        if (enforceSingleCurrent && checked) {
            const nextEntries = getTimelineEntries(watchedEntries);
            replace(
                normalizeCurrentExperienceEntries(
                    nextEntries.map((entry, currentIndex) => ({
                        ...entry,
                        isCurrent: currentIndex === index,
                    })),
                ),
            );
            return;
        }

        setValue(`${name}.${index}.isCurrent`, checked, { shouldDirty: true, shouldValidate: true });
        if (checked) {
            setValue(`${name}.${index}.endDate`, "", { shouldDirty: true, shouldValidate: true });
        }
    };

    const handleRemove = (index: number) => {
        const nextEntries = getTimelineEntries(watchedEntries).filter((_, currentIndex) => currentIndex !== index);
        if (nextEntries.length === 0) {
            return;
        }

        if (enforceSingleCurrent) {
            replace(normalizeCurrentExperienceEntries(nextEntries));
            return;
        }

        remove(index);
    };

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
                    onClick={() => append({ ...getTimelineDefaultEntry(), isCurrent: false })}
                >
                    {addLabel}
                </Button>
            }
        >
            <div className="space-y-4">
                {fields.map((field, index) => {
                    const entry = toExperienceFormEntry((watchedEntries?.[index] || field) as Partial<ExperienceFormEntry>);

                    return (
                        <SurfaceCard key={field.id} as="article" tone="muted" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">
                                    {entryLabelPrefix} #{index + 1}
                                </h3>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={disabled || fields.length <= 1}
                                    onClick={() => handleRemove(index)}
                                >
                                    Remove
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Field
                                    label="Title"
                                    htmlFor={`${sectionKey}-title-${index}`}
                                    error={getEntryError(errors, name, index, "title")}
                                >
                                    <TextInput
                                        id={`${sectionKey}-title-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, name, index, "title"))}
                                        defaultValue={entry.title}
                                        placeholder={titlePlaceholder}
                                        {...register(`${name}.${index}.title`)}
                                    />
                                </Field>

                                <Field
                                    label="Company"
                                    htmlFor={`${sectionKey}-company-${index}`}
                                    error={getEntryError(errors, name, index, "company")}
                                >
                                    <TextInput
                                        id={`${sectionKey}-company-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, name, index, "company"))}
                                        defaultValue={entry.company}
                                        placeholder={companyPlaceholder}
                                        {...register(`${name}.${index}.company`)}
                                    />
                                </Field>

                                <Field
                                    label="Location"
                                    htmlFor={`${sectionKey}-location-${index}`}
                                    error={getEntryError(errors, name, index, "location")}
                                >
                                    <TextInput
                                        id={`${sectionKey}-location-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, name, index, "location"))}
                                        defaultValue={entry.location}
                                        placeholder="Location (optional)"
                                        {...register(`${name}.${index}.location`)}
                                    />
                                </Field>

                                <Field label="Status">
                                    <ChoiceLabel>
                                        <ChoiceInput
                                            type={enforceSingleCurrent ? "radio" : "checkbox"}
                                            name={enforceSingleCurrent ? `${sectionKey}-current` : undefined}
                                            disabled={disabled}
                                            checked={entry.isCurrent}
                                            onChange={(event) => handleCurrentToggle(index, event.target.checked)}
                                        />
                                        {currentLabel}
                                    </ChoiceLabel>
                                </Field>

                                <Field
                                    label="Start date"
                                    htmlFor={`${sectionKey}-start-${index}`}
                                    error={getEntryError(errors, name, index, "startDate")}
                                >
                                    <TextInput
                                        id={`${sectionKey}-start-${index}`}
                                        type="date"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, name, index, "startDate"))}
                                        defaultValue={entry.startDate}
                                        {...register(`${name}.${index}.startDate`)}
                                    />
                                </Field>

                                <Field
                                    label="End date"
                                    htmlFor={`${sectionKey}-end-${index}`}
                                    error={getEntryError(errors, name, index, "endDate")}
                                >
                                    <TextInput
                                        id={`${sectionKey}-end-${index}`}
                                        type="date"
                                        disabled={disabled || entry.isCurrent}
                                        invalid={Boolean(getEntryError(errors, name, index, "endDate"))}
                                        defaultValue={entry.endDate}
                                        {...register(`${name}.${index}.endDate`)}
                                    />
                                </Field>
                            </div>

                            <Field
                                label="Description"
                                htmlFor={`${sectionKey}-description-${index}`}
                                hint="Keep this concise. Candidates mostly need context and outcomes."
                                error={getEntryError(errors, name, index, "description")}
                            >
                                <TextAreaInput
                                    id={`${sectionKey}-description-${index}`}
                                    disabled={disabled}
                                    invalid={Boolean(getEntryError(errors, name, index, "description"))}
                                    defaultValue={entry.description}
                                    rows={3}
                                    autoResize
                                    placeholder="Description (optional)"
                                    {...register(`${name}.${index}.description`)}
                                />
                            </Field>
                        </SurfaceCard>
                    );
                })}
            </div>
        </FormSection>
    );
}
