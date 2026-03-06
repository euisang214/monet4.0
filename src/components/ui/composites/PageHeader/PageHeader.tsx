import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import styles from "./PageHeader.module.css";

const pageHeaderVariants = cva(styles.header, {
    variants: {
        align: {
            start: "",
            center: styles.center,
        },
    },
    defaultVariants: {
        align: "start",
    },
});

interface PageHeaderProps {
    eyebrow?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    meta?: React.ReactNode;
    align?: "start" | "center";
    className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, meta, align, className }: PageHeaderProps) {
    return (
        <header className={cn(pageHeaderVariants({ align }), className)}>
            <div className={styles.copy}>
                {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
                <h1 className={styles.title}>{title}</h1>
                {description ? <p className={styles.description}>{description}</p> : null}
            </div>
            {actions || meta ? (
                <div className={cn(actions ? "" : styles.meta)}>
                    {actions ?? meta}
                </div>
            ) : null}
        </header>
    );
}
