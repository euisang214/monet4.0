import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import styles from "./InlineNotice.module.css";

const inlineNoticeVariants = cva(styles.notice, {
    variants: {
        tone: {
            neutral: styles.toneNeutral,
            success: styles.toneSuccess,
            error: styles.toneError,
            warning: styles.toneWarning,
            info: styles.toneInfo,
        },
    },
    defaultVariants: {
        tone: "info",
    },
});

export interface InlineNoticeProps {
    tone?: "neutral" | "success" | "error" | "warning" | "info";
    title?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export function InlineNotice({ tone, title, className, children }: InlineNoticeProps) {
    return (
        <div className={cn(inlineNoticeVariants({ tone }), className)} role={tone === "error" ? "alert" : "status"}>
            {title ? <p className={styles.title}>{title}</p> : null}
            <div>{children}</div>
        </div>
    );
}
