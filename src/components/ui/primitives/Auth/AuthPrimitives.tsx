import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import { InlineNotice } from "@/components/ui/composites/InlineNotice/InlineNotice";
import styles from "./AuthPrimitives.module.css";

const authMessageVariants = cva(styles.message, {
    variants: {
        tone: {
            neutral: styles.toneNeutral,
            success: styles.toneSuccess,
            warning: styles.toneWarning,
            error: styles.toneError,
        },
    },
    defaultVariants: {
        tone: "neutral",
    },
});

type AuthShellProps = {
    children: React.ReactNode;
    className?: string;
};

export function AuthShell({ children, className }: AuthShellProps) {
    return <main className={cn(styles.shell, className)}>{children}</main>;
}

type AuthCardProps = {
    children: React.ReactNode;
    className?: string;
};

export function AuthCard({ children, className }: AuthCardProps) {
    return <section className={cn(styles.card, className)}>{children}</section>;
}

type AuthFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
    label: string;
    className?: string;
    srOnlyLabel?: boolean;
};

export function AuthField({ id, label, className, srOnlyLabel = true, ...props }: AuthFieldProps) {
    return (
        <div className={styles.field}>
            <label htmlFor={id} className={srOnlyLabel ? styles.srOnly : styles.label}>
                {label}
            </label>
            <input
                id={id}
                className={cn(styles.input, className)}
                {...props}
            />
        </div>
    );
}

type AuthMessageProps = {
    children: React.ReactNode;
    tone?: "neutral" | "success" | "warning" | "error";
    className?: string;
};

export function AuthMessage({ children, tone = "neutral", className }: AuthMessageProps) {
    return (
        <InlineNotice
            tone={tone === "neutral" ? "neutral" : tone}
            className={cn(authMessageVariants({ tone }), className)}
        >
            {children}
        </InlineNotice>
    );
}
