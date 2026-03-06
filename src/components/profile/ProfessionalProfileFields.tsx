"use client";

import { Field, TextAreaInput, TextInput } from "@/components/ui";

type ProfessionalProfileFieldsProps = {
    bio: string;
    onBioChange: (value: string) => void;
    price: string;
    onPriceChange: (value: string) => void;
    corporateEmail: string;
    onCorporateEmailChange: (value: string) => void;
    interests: string;
    onInterestsChange: (value: string) => void;
    showCorporateEmail?: boolean;
    disabled?: boolean;
};

export function ProfessionalProfileFields({
    bio,
    onBioChange,
    price,
    onPriceChange,
    corporateEmail,
    onCorporateEmailChange,
    interests,
    onInterestsChange,
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
                >
                    <TextAreaInput
                        id="professional-bio"
                        required
                        disabled={disabled}
                        value={bio}
                        onChange={(event) => onBioChange(event.target.value)}
                        rows={5}
                        autoResize
                        tall
                    />
                </Field>
            </div>

            <div>
                <Field label="Hourly rate ($)" htmlFor="professional-price">
                    <TextInput
                        id="professional-price"
                        required
                        disabled={disabled}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={price}
                        onChange={(event) => onPriceChange(event.target.value)}
                    />
                </Field>
            </div>

            {showCorporateEmail ? (
                <div>
                    <Field
                        label="Corporate email"
                        htmlFor="professional-corporate-email"
                        hint="Use the inbox tied to your current employer for verification."
                    >
                        <TextInput
                            id="professional-corporate-email"
                            required
                            disabled={disabled}
                            type="email"
                            value={corporateEmail}
                            onChange={(event) => onCorporateEmailChange(event.target.value)}
                        />
                    </Field>
                </div>
            ) : null}

            <div className="md:col-span-2">
                <Field
                    label="Interests (comma separated)"
                    htmlFor="professional-interests"
                    hint="This helps Monet position your profile in browse and booking flows."
                >
                    <TextInput
                        id="professional-interests"
                        required
                        disabled={disabled}
                        type="text"
                        value={interests}
                        onChange={(event) => onInterestsChange(event.target.value)}
                        placeholder="Mentorship, Interview Coaching, Leadership"
                    />
                </Field>
            </div>
        </div>
    );
}
