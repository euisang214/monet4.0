"use client";

import React from "react";
import { cn } from "@/lib/ui/cn";
import { buttonVariants, type ButtonVariantProps } from "./buttonVariants";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
    children: React.ReactNode;
    loading?: boolean;
    loadingLabel?: string;
}

export function Button({
    children,
    className,
    type = "button",
    variant,
    size,
    loading = false,
    loadingLabel,
    disabled,
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={cn(buttonVariants({ variant, size }), className)}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...props}
        >
            {loading ? loadingLabel ?? children : children}
        </button>
    );
}
