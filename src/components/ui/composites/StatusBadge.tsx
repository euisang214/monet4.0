import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import styles from "./StatusBadge.module.css";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const badgeVariants = cva(styles.badge, {
    variants: {
        variant: {
            success: styles.success,
            warning: styles.warning,
            danger: styles.danger,
            info: styles.info,
            neutral: styles.neutral,
        },
    },
    defaultVariants: {
        variant: "neutral",
    },
});

interface StatusBadgeProps {
    label: string;
    variant: BadgeVariant;
    className?: string;
}

export function StatusBadge({ label, variant, className }: StatusBadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)}>{label}</span>;
}
