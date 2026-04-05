"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui";
import type { ProfessionalProfileFormInput } from "@/components/profile/shared/profileEditorSchemas";
import {
    PROFESSIONAL_INDUSTRIES,
    PROFESSIONAL_INDUSTRY_LABELS,
} from "@/lib/shared/professional-industries";
import {
    PROFESSIONAL_SENIORITIES,
    PROFESSIONAL_SENIORITY_LABELS,
} from "@/lib/shared/professional-seniority";

type ProfessionalProfileFieldsProps = {
    register: UseFormRegister<ProfessionalProfileFormInput>;
    errors?: FieldErrors<ProfessionalProfileFormInput>;
    defaults: Pick<ProfessionalProfileFormInput, "bio" | "industry" | "seniority" | "price" | "corporateEmail" | "interestsText">;
    onCorporateEmailChange?: (value: string) => void;
    showCorporateEmail?: boolean;
    disabled?: boolean;
};

export function ProfessionalProfileFields({
    register,
    errors,
    defaults,
    onCorporateEmailChange,
    showCorporateEmail = true,
    disabled = false,
}: ProfessionalProfileFieldsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
                <Field
                    label="Bio"
                    htmlFor="professional-bio"
                    hint="Focus on the perspective, industries, and outcomes candidates can expect from a session."
                    error={errors?.bio?.message}
                >
                    <TextAreaInput
                        id="professional-bio"
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.bio)}
                        defaultValue={defaults.bio}
                        rows={5}
                        autoResize
                        tall
                        {...register("bio")}
                    />
                </Field>
            </div>

            <div>
                <Field
                    label="Industry"
                    htmlFor="professional-industry"
                    hint="Choose the industry candidates should associate with your profile."
                    error={errors?.industry?.message}
                >
                    <SelectInput
                        id="professional-industry"
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.industry)}
                        defaultValue={defaults.industry}
                        {...register("industry")}
                    >
                        <option value="">Select an industry</option>
                        {PROFESSIONAL_INDUSTRIES.map((industry) => (
                            <option key={industry} value={industry}>
                                {PROFESSIONAL_INDUSTRY_LABELS[industry]}
                            </option>
                        ))}
                    </SelectInput>
                </Field>
            </div>

            <div>
                <Field
                    label="Seniority"
                    htmlFor="professional-seniority"
                    hint="Choose the level candidates should associate with your current role."
                    error={errors?.seniority?.message}
                >
                    <SelectInput
                        id="professional-seniority"
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.seniority)}
                        defaultValue={defaults.seniority}
                        {...register("seniority")}
                    >
                        <option value="">Select seniority</option>
                        {PROFESSIONAL_SENIORITIES.map((seniority) => (
                            <option key={seniority} value={seniority}>
                                {PROFESSIONAL_SENIORITY_LABELS[seniority]}
                            </option>
                        ))}
                    </SelectInput>
                </Field>
            </div>

            <div>
                <Field label="Hourly rate ($)" htmlFor="professional-price" error={errors?.price?.message}>
                    <TextInput
                        id="professional-price"
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.price)}
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={defaults.price}
                        {...register("price")}
                    />
                </Field>
            </div>

            {showCorporateEmail ? (
                <div>
                    <Field
                        label="Corporate email"
                        htmlFor="professional-corporate-email"
                        hint="Use the inbox tied to your current employer for verification."
                        error={errors?.corporateEmail?.message}
                    >
                        <TextInput
                            id="professional-corporate-email"
                            required
                            disabled={disabled}
                            invalid={Boolean(errors?.corporateEmail)}
                            type="email"
                            defaultValue={defaults.corporateEmail}
                            {...register("corporateEmail", {
                                onChange: (event) => onCorporateEmailChange?.(event.target.value),
                            })}
                        />
                    </Field>
                </div>
            ) : null}

            <div className="md:col-span-2">
                <Field
                    label="Interests (comma separated)"
                    htmlFor="professional-interests"
                    hint="This helps Kafei position your profile in browse and booking flows."
                    error={errors?.interestsText?.message}
                >
                    <TextInput
                        id="professional-interests"
                        required
                        disabled={disabled}
                        invalid={Boolean(errors?.interestsText)}
                        type="text"
                        defaultValue={defaults.interestsText}
                        placeholder="Mentorship, Interview Coaching, Leadership"
                        {...register("interestsText")}
                    />
                </Field>
            </div>
        </div>
    );
}
