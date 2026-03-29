"use client";

import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import { AutoResizeTextarea } from "@/components/profile/shared/AutoResizeTextarea";
import styles from "./FormPrimitives.module.css";

type FieldProps = {
    label?: React.ReactNode;
    htmlFor?: string;
    hint?: React.ReactNode;
    error?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
};

const controlVariants = cva(styles.control, {
    variants: {
        density: {
            default: "",
            compact: "",
        },
    },
    defaultVariants: {
        density: "default",
    },
});

const sectionVariants = cva(styles.section, {
    variants: {
        tone: {
            default: "",
            muted: styles.sectionMuted,
        },
    },
    defaultVariants: {
        tone: "default",
    },
});

type FormSectionProps = {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    tone?: "default" | "muted";
    children: React.ReactNode;
};

type ControlProps = {
    invalid?: boolean;
};

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & ControlProps;
type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & ControlProps;
type FileInputProps = React.InputHTMLAttributes<HTMLInputElement> & ControlProps;
type TextAreaInputProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
    ControlProps & {
        autoResize?: boolean;
        tall?: boolean;
    };

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
    return (
        <div className={cn(styles.field, className)}>
            {label || hint ? (
                <div className={styles.fieldHeader}>
                    {label ? (
                        <label htmlFor={htmlFor} className={styles.label}>
                            {label}
                        </label>
                    ) : null}
                    {hint ? <p className={styles.hint}>{hint}</p> : null}
                </div>
            ) : null}
            {children}
            {error ? <p className={styles.error}>{error}</p> : null}
        </div>
    );
}

export function TextInput({ className, invalid = false, ...props }: TextInputProps) {
    return <input {...props} className={cn(controlVariants(), className)} data-invalid={invalid || undefined} />;
}

export function SelectInput({ className, invalid = false, ...props }: SelectInputProps) {
    return (
        <select
            {...props}
            className={cn(controlVariants(), styles.select, className)}
            data-invalid={invalid || undefined}
        />
    );
}

export function TextAreaInput({
    className,
    invalid = false,
    autoResize = false,
    tall = false,
    ...props
}: TextAreaInputProps) {
    const textareaClassName = cn(controlVariants(), styles.textarea, tall && styles.textareaTall, className);

    if (autoResize) {
        return (
            <AutoResizeTextarea
                {...props}
                className={textareaClassName}
                data-invalid={invalid || undefined}
            />
        );
    }

    return <textarea {...props} className={textareaClassName} data-invalid={invalid || undefined} />;
}

export function FileInput({ className, invalid = false, ...props }: FileInputProps) {
    return (
        <input
            {...props}
            className={cn(controlVariants(), styles.fileInput, className)}
            data-invalid={invalid || undefined}
        />
    );
}

export function FormSection({ title, description, actions, className, tone, children }: FormSectionProps) {
    return (
        <section className={cn(sectionVariants({ tone }), className)}>
            <div className={styles.sectionHeader}>
                <div className={styles.sectionCopy}>
                    <h2 className={styles.sectionTitle}>{title}</h2>
                    {description ? <p className={styles.sectionDescription}>{description}</p> : null}
                </div>
                {actions}
            </div>
            <div className={styles.sectionBody}>{children}</div>
        </section>
    );
}

export function ChoiceLabel({
    className,
    children,
    ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
    return (
        <label {...props} className={cn(styles.choiceLabel, className)}>
            {children}
        </label>
    );
}

export function ChoiceInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return <input {...props} className={cn(styles.choiceInput, props.className)} />;
}
