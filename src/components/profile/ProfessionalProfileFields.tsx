"use client";

import { AutoResizeTextarea } from "@/components/profile/shared/AutoResizeTextarea";

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
                <label htmlFor="professional-bio" className="block text-sm font-medium mb-1">
                    Bio
                </label>
                <AutoResizeTextarea
                    id="professional-bio"
                    required
                    disabled={disabled}
                    value={bio}
                    onChange={(event) => onBioChange(event.target.value)}
                    className="w-full p-2 border rounded-md"
                    rows={5}
                    style={{ minHeight: "7rem" }}
                />
            </div>

            <div>
                <label htmlFor="professional-price" className="block text-sm font-medium mb-1">
                    Hourly rate ($)
                </label>
                <input
                    id="professional-price"
                    required
                    disabled={disabled}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={price}
                    onChange={(event) => onPriceChange(event.target.value)}
                    className="w-full p-2 border rounded-md"
                />
            </div>

            {showCorporateEmail ? (
                <div>
                    <label htmlFor="professional-corporate-email" className="block text-sm font-medium mb-1">
                        Corporate email
                    </label>
                    <input
                        id="professional-corporate-email"
                        required
                        disabled={disabled}
                        type="email"
                        value={corporateEmail}
                        onChange={(event) => onCorporateEmailChange(event.target.value)}
                        className="w-full p-2 border rounded-md"
                    />
                </div>
            ) : null}

            <div className="md:col-span-2">
                <label htmlFor="professional-interests" className="block text-sm font-medium mb-1">
                    Interests (comma separated)
                </label>
                <input
                    id="professional-interests"
                    required
                    disabled={disabled}
                    type="text"
                    value={interests}
                    onChange={(event) => onInterestsChange(event.target.value)}
                    className="w-full p-2 border rounded-md"
                    placeholder="Mentorship, Interview Coaching, Leadership"
                />
            </div>
        </div>
    );
}
