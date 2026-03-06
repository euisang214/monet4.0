import React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../../../lib/ui/cn";

const authMessageVariants = cva("rounded-md p-3 text-sm", {
    variants: {
        tone: {
            neutral: "bg-gray-50 text-gray-700",
            success: "bg-green-50 text-green-700",
            warning: "bg-yellow-50 text-yellow-700",
            error: "bg-red-50 text-red-700",
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
    return <main className={cn("min-h-screen flex items-center justify-center px-4 py-12", className)}>{children}</main>;
}

type AuthCardProps = {
    children: React.ReactNode;
    className?: string;
};

export function AuthCard({ children, className }: AuthCardProps) {
    return <section className={cn("w-full max-w-md mx-auto bg-white p-8 rounded-xl border border-gray-200 shadow-lg space-y-6", className)}>{children}</section>;
}

type AuthFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "className"> & {
    label: string;
    className?: string;
    srOnlyLabel?: boolean;
};

export function AuthField({ id, label, className, srOnlyLabel = true, ...props }: AuthFieldProps) {
    return (
        <div>
            <label htmlFor={id} className={srOnlyLabel ? "sr-only" : "block text-sm font-medium text-gray-700 mb-1"}>
                {label}
            </label>
            <input
                id={id}
                className={cn(
                    "relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500",
                    "focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm",
                    className
                )}
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
    return <div className={cn(authMessageVariants({ tone }), className)}>{children}</div>;
}
