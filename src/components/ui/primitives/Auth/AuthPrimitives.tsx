import React from "react";
import Link from "next/link";
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
    return (
        <main className={cn(styles.shell, className)}>
            <div className={styles.shellBackdrop} aria-hidden="true">
                <span className={styles.shellGlowPrimary} />
                <span className={styles.shellGlowSecondary} />
                <span className={styles.shellGrid} />
            </div>

            <div className={styles.shellFrame}>
                <section className={styles.shellStory}>
                    <Link href="/" className={styles.brandLink}>
                        <span className={styles.brandBadge} />
                        Kafei
                    </Link>

                    <div className={styles.storyCopy}>
                        <p className={styles.storyEyebrow}>Structured recruiting conversations</p>
                        <h1 className={styles.storyTitle}>A more intentional way to connect candidates and professionals.</h1>
                        <p className={styles.storyDescription}>
                            Kafei keeps the scheduling, payment, and follow-up workflow tight so the real value stays in the conversation itself.
                        </p>
                    </div>

                    <div className={styles.storyPoints}>
                        <article className={styles.storyPoint}>
                            <h2 className={styles.storyPointTitle}>Focused sessions</h2>
                            <p className={styles.storyPointDescription}>Thirty-minute calls built for practical feedback, not vague networking.</p>
                        </article>
                        <article className={styles.storyPoint}>
                            <h2 className={styles.storyPointTitle}>Operationally clean</h2>
                            <p className={styles.storyPointDescription}>Calendar sync, secure payments, and reminders are handled in one place.</p>
                        </article>
                        <article className={styles.storyPoint}>
                            <h2 className={styles.storyPointTitle}>Trust by default</h2>
                            <p className={styles.storyPointDescription}>Verified participants and structured follow-through make the marketplace feel dependable.</p>
                        </article>
                    </div>
                </section>

                <div className={styles.shellFormColumn}>{children}</div>
            </div>
        </main>
    );
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
