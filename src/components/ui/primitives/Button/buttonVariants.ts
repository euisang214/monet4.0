import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva("btn transition-colors", {
    variants: {
        variant: {
            primary: "bg-blue-600 text-white hover:bg-blue-700",
            secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
            ghost: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
            danger: "bg-red-600 text-white hover:bg-red-700",
        },
        size: {
            sm: "px-3 py-1.5 text-sm",
            md: "px-4 py-2 text-sm",
            lg: "px-5 py-3 text-base",
        },
    },
    defaultVariants: {
        variant: "primary",
        size: "md",
    },
});

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
