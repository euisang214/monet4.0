"use client";

import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export function Button({ children, className, type = "button", ...props }: ButtonProps) {
    const classes = [
        "btn",
        "bg-blue-600",
        "text-white",
        "px-4",
        "py-2",
        "rounded-md",
        "transition-colors",
        "hover:bg-blue-700",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <button type={type} className={classes} {...props}>
            {children}
        </button>
    );
}
