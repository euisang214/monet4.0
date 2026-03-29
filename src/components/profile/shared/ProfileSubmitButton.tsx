"use client";

import { Button } from "@/components/ui";

type ProfileSubmitButtonProps = {
    submitLabel: string;
    submittingLabel: string;
    disabled: boolean;
    loading: boolean;
};

export function ProfileSubmitButton({
    submitLabel,
    submittingLabel,
    disabled,
    loading,
}: ProfileSubmitButtonProps) {
    return (
        <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            loadingLabel={submittingLabel}
            disabled={disabled}
        >
            {submitLabel}
        </Button>
    );
}
