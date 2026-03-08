"use client";

import { InlineNotice } from "@/components/ui";

type ProfileFormNoticeProps = {
    errorMessage: string | null;
};

export function ProfileFormNotice({ errorMessage }: ProfileFormNoticeProps) {
    if (!errorMessage) {
        return null;
    }

    return (
        <InlineNotice tone="error" title="Profile issue">
            {errorMessage}
        </InlineNotice>
    );
}
