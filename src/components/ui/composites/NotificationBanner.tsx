import React from "react";
import type { NotificationState } from "@/components/ui/hooks/useNotification";
import { InlineNotice, type InlineNoticeProps } from "@/components/ui/composites/InlineNotice/InlineNotice";

type NotificationTone = "success" | "error" | "warning" | "info";

interface NotificationBannerProps {
    notification?: NotificationState | null;
    tone?: NotificationTone;
    title?: React.ReactNode;
    message?: React.ReactNode;
    className?: string;
}

function resolveTone(notification?: NotificationState | null, tone?: NotificationTone): InlineNoticeProps["tone"] {
    if (tone) return tone;
    if (notification?.type === "success") return "success";
    if (notification?.type === "error") return "error";
    return "info";
}

export function NotificationBanner({ notification, tone, title, message, className }: NotificationBannerProps) {
    const content = message ?? notification?.message;
    if (!content) return null;

    return (
        <InlineNotice
            tone={resolveTone(notification, tone)}
            title={title}
            className={className}
        >
            {content}
        </InlineNotice>
    );
}
