"use client";

import Link from "next/link";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import type { RequestToastState } from "@/components/ui/hooks/requestToastController";
import styles from "./RequestToast.module.css";

const toastVariants = cva(styles.toast, {
    variants: {
        tone: {
            loading: styles.toneLoading,
            success: styles.toneSuccess,
            error: styles.toneError,
            warning: styles.toneWarning,
        },
    },
});

interface RequestToastProps {
    toast: RequestToastState | null;
    onDismiss: () => void;
}

export function RequestToast({ toast, onDismiss }: RequestToastProps) {
    if (!toast) return null;

    const action = toast.copy.actionHref && toast.copy.actionLabel
        ? toast.copy.actionHref.startsWith("/")
            ? (
                <Link href={toast.copy.actionHref} className={styles.action}>
                    {toast.copy.actionLabel}
                </Link>
            )
            : (
                <a href={toast.copy.actionHref} className={styles.action}>
                    {toast.copy.actionLabel}
                </a>
            )
        : null;

    return (
        <div className={styles.viewport}>
            <section
                className={cn(toastVariants({ tone: toast.tone }))}
                role={toast.tone === "error" || toast.tone === "warning" ? "alert" : "status"}
                aria-live={toast.tone === "loading" || toast.tone === "success" ? "polite" : "assertive"}
                aria-atomic="true"
            >
                <div className={styles.header}>
                    <div className={styles.copy}>
                        <p className={styles.eyebrow}>
                            <span className={cn(styles.icon, toast.tone === "loading" && styles.loadingIcon)} aria-hidden="true" />
                            {toast.tone === "loading" ? "In progress" : toast.tone}
                        </p>
                        <p className={styles.title}>{toast.copy.title}</p>
                        <p className={styles.message}>{toast.copy.message}</p>
                    </div>
                    <button type="button" onClick={onDismiss} className={styles.dismiss} aria-label="Dismiss notification">
                        Dismiss
                    </button>
                </div>

                {action ? <div className={styles.footer}>{action}</div> : null}
            </section>
        </div>
    );
}
