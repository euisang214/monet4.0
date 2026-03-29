"use client";

import {
    useFieldArray,
    useWatch,
    type Control,
    type FieldErrors,
    type UseFormRegister,
    type UseFormSetValue,
} from "react-hook-form";
import type { EducationFormEntry } from "@/components/profile/shared/profileFormAdapters";
import { getEducationDefaultEntry } from "@/components/profile/shared/profileEditorSchemas";
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
    control: Control<any>;
    register: UseFormRegister<any>;
    setValue: UseFormSetValue<any>;
    errors?: FieldErrors<any>;
    disabled?: boolean;
};

function getEntryError(
    errors: FieldErrors<any> | undefined,
    index: number,
    field: keyof EducationFormEntry,
) {
    const maybeFieldError = errors?.education;
    if (!Array.isArray(maybeFieldError)) {
        return undefined;
    }

    const message = maybeFieldError[index]?.[field]?.message;
    return typeof message === "string" ? message : undefined;
}

function toEducationFormEntry(entry: Partial<EducationFormEntry> | undefined): EducationFormEntry {
    return {
        school: entry?.school || "",
        degree: entry?.degree || "",
        fieldOfStudy: entry?.fieldOfStudy || "",
        location: entry?.location || "",
        startDate: entry?.startDate || "",
        endDate: entry?.endDate || "",
        isCurrent: entry?.isCurrent === true,
        gpa: entry?.gpa || "",
        honors: entry?.honors || "",
        activities: entry?.activities || "",
    };
}

export function EducationEntriesEditor({
    control,
    register,
    setValue,
    errors,
    disabled = false,
}: EducationEntriesEditorProps) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "education",
    });
    const watchedEntries = useWatch({
        control,
        name: "education",
    }) as EducationFormEntry[] | undefined;

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
                    onClick={() => append(getEducationDefaultEntry())}
                >
                    Add education
                </Button>
            }
        >
            <div className="space-y-4">
                {fields.map((field, index) => {
                    const entry = toEducationFormEntry((watchedEntries?.[index] || field) as Partial<EducationFormEntry>);

                    return (
                        <SurfaceCard key={field.id} as="article" tone="muted" className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-900">Education #{index + 1}</h3>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={disabled || fields.length <= 1}
                                    onClick={() => remove(index)}
                                >
                                    Remove
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Field
                                    label="School"
                                    htmlFor={`education-school-${index}`}
                                    error={getEntryError(errors, index, "school")}
                                >
                                    <TextInput
                                        id={`education-school-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, index, "school"))}
                                        defaultValue={entry.school}
                                        placeholder="School"
                                        {...register(`education.${index}.school`)}
                                    />
                                </Field>

                                <Field
                                    label="Degree"
                                    htmlFor={`education-degree-${index}`}
                                    error={getEntryError(errors, index, "degree")}
                                >
                                    <TextInput
                                        id={`education-degree-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, index, "degree"))}
                                        defaultValue={entry.degree}
                                        placeholder="Degree"
                                        {...register(`education.${index}.degree`)}
                                    />
                                </Field>

                                <Field
                                    label="Field of study"
                                    htmlFor={`education-field-${index}`}
                                    error={getEntryError(errors, index, "fieldOfStudy")}
                                >
                                    <TextInput
                                        id={`education-field-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, index, "fieldOfStudy"))}
                                        defaultValue={entry.fieldOfStudy}
                                        placeholder="Field of study"
                                        {...register(`education.${index}.fieldOfStudy`)}
                                    />
                                </Field>

                                <Field
                                    label="Location"
                                    htmlFor={`education-location-${index}`}
                                    error={getEntryError(errors, index, "location")}
                                >
                                    <TextInput
                                        id={`education-location-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, index, "location"))}
                                        defaultValue={entry.location}
                                        placeholder="Location (optional)"
                                        {...register(`education.${index}.location`)}
                                    />
                                </Field>

                                <Field
                                    label="Start date"
                                    htmlFor={`education-start-${index}`}
                                    error={getEntryError(errors, index, "startDate")}
                                >
                                    <TextInput
                                        id={`education-start-${index}`}
                                        type="date"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, index, "startDate"))}
                                        defaultValue={entry.startDate}
                                        {...register(`education.${index}.startDate`)}
                                    />
                                </Field>

                                <Field
                                    label="End date"
                                    htmlFor={`education-end-${index}`}
                                    error={getEntryError(errors, index, "endDate")}
                                >
                                    <TextInput
                                        id={`education-end-${index}`}
                                        type="date"
                                        disabled={disabled || entry.isCurrent}
                                        invalid={Boolean(getEntryError(errors, index, "endDate"))}
                                        defaultValue={entry.endDate}
                                        {...register(`education.${index}.endDate`)}
                                    />
                                </Field>

                                <Field label="Status">
                                    <ChoiceLabel>
                                        <ChoiceInput
                                            type="checkbox"
                                            disabled={disabled}
                                            checked={entry.isCurrent}
                                            onChange={(event) => {
                                                setValue(`education.${index}.isCurrent`, event.target.checked, {
                                                    shouldDirty: true,
                                                    shouldValidate: true,
                                                });
                                                if (event.target.checked) {
                                                    setValue(`education.${index}.endDate`, "", {
                                                        shouldDirty: true,
                                                        shouldValidate: true,
                                                    });
                                                }
                                            }}
                                        />
                                        Currently studying here
                                    </ChoiceLabel>
                                </Field>

                                <Field
                                    label="GPA"
                                    htmlFor={`education-gpa-${index}`}
                                    error={getEntryError(errors, index, "gpa")}
                                >
                                    <TextInput
                                        id={`education-gpa-${index}`}
                                        type="text"
                                        disabled={disabled}
                                        invalid={Boolean(getEntryError(errors, index, "gpa"))}
                                        defaultValue={entry.gpa}
                                        placeholder="GPA (optional)"
                                        {...register(`education.${index}.gpa`)}
                                    />
                                </Field>
                            </div>

                            <Field
                                label="Honors"
                                htmlFor={`education-honors-${index}`}
                                error={getEntryError(errors, index, "honors")}
                            >
                                <TextInput
                                    id={`education-honors-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    invalid={Boolean(getEntryError(errors, index, "honors"))}
                                    defaultValue={entry.honors}
                                    placeholder="Honors (optional)"
                                    {...register(`education.${index}.honors`)}
                                />
                            </Field>

                            <Field
                                label="Activities"
                                htmlFor={`education-activities-${index}`}
                                error={getEntryError(errors, index, "activities")}
                            >
                                <TextInput
                                    id={`education-activities-${index}`}
                                    type="text"
                                    disabled={disabled}
                                    invalid={Boolean(getEntryError(errors, index, "activities"))}
                                    defaultValue={entry.activities}
                                    placeholder="Education activities (comma separated, optional)"
                                    {...register(`education.${index}.activities`)}
                                />
                            </Field>
                        </SurfaceCard>
                    );
                })}
            </div>
        </FormSection>
    );
}
