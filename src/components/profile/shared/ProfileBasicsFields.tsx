"use client";

import type { FieldErrors, FieldValues, Path, UseFormRegister, UseFormSetValue } from "react-hook-form";
import { Field, SelectInput, TextInput } from "@/components/ui";
import { SUPPORTED_TIMEZONES } from "@/lib/utils/supported-timezones";

type ProfileBasicsDefaults = {
    firstName: string;
    lastName: string;
    timezone: string;
};

type ProfileBasicsFieldsProps<TFormValues extends FieldValues> = {
    mode: string;
    prefix: string;
    timezoneId?: string;
    register: UseFormRegister<TFormValues>;
    setValue: UseFormSetValue<TFormValues>;
    errors?: FieldErrors<TFormValues>;
    defaults: ProfileBasicsDefaults;
    timezone: string;
    disabled?: boolean;
};

export function ProfileBasicsFields<TFormValues extends FieldValues>({
    mode,
    prefix,
    timezoneId,
    register,
    setValue,
    errors,
    defaults,
    timezone,
    disabled = false,
}: ProfileBasicsFieldsProps<TFormValues>) {
    const firstNamePath = "firstName" as Path<TFormValues>;
    const lastNamePath = "lastName" as Path<TFormValues>;
    const timezonePath = "timezone" as Path<TFormValues>;

    return (
        <>
            <div className="grid gap-4 md:grid-cols-2">
                <Field
                    label="First name"
                    htmlFor={`${prefix}-first-name-${mode}`}
                    error={errors?.[firstNamePath]?.message as string | undefined}
                >
                    <TextInput
                        id={`${prefix}-first-name-${mode}`}
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.[firstNamePath])}
                        type="text"
                        defaultValue={defaults.firstName}
                        placeholder="First name"
                        {...register(firstNamePath)}
                    />
                </Field>

                <Field
                    label="Last name"
                    htmlFor={`${prefix}-last-name-${mode}`}
                    error={errors?.[lastNamePath]?.message as string | undefined}
                >
                    <TextInput
                        id={`${prefix}-last-name-${mode}`}
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.[lastNamePath])}
                        type="text"
                        defaultValue={defaults.lastName}
                        placeholder="Last name"
                        {...register(lastNamePath)}
                    />
                </Field>
            </div>

            <Field
                label="Timezone"
                htmlFor={timezoneId || `${prefix}-timezone-${mode}`}
                error={errors?.[timezonePath]?.message as string | undefined}
            >
                <SelectInput
                    id={timezoneId || `${prefix}-timezone-${mode}`}
                    required
                    disabled={disabled}
                    invalid={Boolean(errors?.[timezonePath])}
                    value={timezone}
                    onChange={(event) => {
                        setValue(timezonePath, event.target.value as TFormValues[Path<TFormValues>], {
                            shouldDirty: true,
                            shouldValidate: true,
                        });
                    }}
                >
                    {SUPPORTED_TIMEZONES.map((timezoneOption) => (
                        <option key={timezoneOption} value={timezoneOption}>
                            {timezoneOption}
                        </option>
                    ))}
                </SelectInput>
            </Field>
        </>
    );
}
