import { cva, type VariantProps } from "class-variance-authority";
import styles from "./Button.module.css";

export const buttonVariants = cva(styles.button, {
    variants: {
        variant: {
            primary: styles.primary,
            secondary: styles.secondary,
            ghost: styles.ghost,
            danger: styles.danger,
            glass: styles.glass,
            "glass-primary": styles.glassPrimary,
            "glass-ghost": styles.glassGhost,
        },
        size: {
            sm: styles.sizeSm,
            md: styles.sizeMd,
            lg: styles.sizeLg,
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "md",
    },
});

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
