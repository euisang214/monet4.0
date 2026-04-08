import React from "react";
import { cn } from "@/lib/ui/cn";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";
import styles from "./BookingFlowShell.module.css";

export interface BookingFlowStep {
    label: string;
    description?: string;
    status: "complete" | "current" | "upcoming";
}

interface BookingFlowShellProps {
    eyebrow?: React.ReactNode;
    title?: React.ReactNode;
    description?: React.ReactNode;
    steps?: BookingFlowStep[];
    children: React.ReactNode;
    summaryTitle: React.ReactNode;
    summaryDescription?: React.ReactNode;
    summary: React.ReactNode;
    summaryFooter?: React.ReactNode;
    className?: string;
    mainClassName?: string;
}

export function BookingFlowShell({
    eyebrow,
    title,
    description,
    steps,
    children,
    summaryTitle,
    summaryDescription,
    summary,
    summaryFooter,
    className,
    mainClassName,
}: BookingFlowShellProps) {
    const showHeader = Boolean(eyebrow || title || description);

    return (
        <section className={cn(styles.shell, className)}>
            {showHeader ? (
                <header className={styles.header}>
                    {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
                    {title ? <h1 className={styles.title}>{title}</h1> : null}
                    {description ? <p className={styles.description}>{description}</p> : null}
                </header>
            ) : null}

            {steps?.length ? (
                <ol className={styles.steps}>
                    {steps.map((step, index) => (
                        <li
                            key={`${index}-${step.label}`}
                            className={cn(
                                styles.step,
                                step.status === "current" && styles.stepCurrent,
                                step.status === "complete" && styles.stepComplete
                            )}
                        >
                            <div className={styles.stepHeader}>
                                <span className={styles.stepIndex}>{index + 1}</span>
                                <span className={styles.stepLabel}>{step.label}</span>
                            </div>
                            {step.description ? <p className={styles.stepDescription}>{step.description}</p> : null}
                        </li>
                    ))}
                </ol>
            ) : null}

            <div className={styles.layout}>
                <div className={cn(styles.main, mainClassName)}>{children}</div>
                <aside className={styles.aside}>
                    <SurfaceCard tone="muted" className={styles.summaryCard}>
                        <div className={styles.summaryHeader}>
                            <p className={styles.summaryTitle}>{summaryTitle}</p>
                            {summaryDescription ? <p className={styles.summaryDescription}>{summaryDescription}</p> : null}
                        </div>
                        <div className={styles.summaryBody}>{summary}</div>
                        {summaryFooter ? <div className={styles.summaryFooter}>{summaryFooter}</div> : null}
                    </SurfaceCard>
                </aside>
            </div>
        </section>
    );
}
