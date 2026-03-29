import React, { type ComponentPropsWithoutRef, type ElementType } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/ui/cn";
import styles from "./SurfaceCard.module.css";

const surfaceCardVariants = cva(styles.card, {
    variants: {
        tone: {
            default: styles.toneDefault,
            muted: styles.toneMuted,
            accent: styles.toneAccent,
        },
        padding: {
            sm: styles.paddingSm,
            md: styles.paddingMd,
            lg: styles.paddingLg,
        },
        interactive: {
            true: styles.interactive,
            false: "",
        },
    },
    defaultVariants: {
        tone: "default",
        padding: "md",
        interactive: false,
    },
});

type SurfaceCardOwnProps<T extends ElementType> = {
    as?: T;
    className?: string;
    children: React.ReactNode;
} & VariantProps<typeof surfaceCardVariants>;

type SurfaceCardProps<T extends ElementType> = SurfaceCardOwnProps<T> &
    Omit<ComponentPropsWithoutRef<T>, keyof SurfaceCardOwnProps<T>>;

export function SurfaceCard<T extends ElementType = "section">({
    as,
    className,
    tone,
    padding,
    interactive,
    children,
    ...props
}: SurfaceCardProps<T>) {
    const Component = as ?? "section";

    return (
        <Component className={cn(surfaceCardVariants({ tone, padding, interactive }), className)} {...props}>
            {children}
        </Component>
    );
}
