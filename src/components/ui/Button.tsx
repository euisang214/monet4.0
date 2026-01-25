"use client";

import React from "react";
import { DevLinkButton } from "@/devlink";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export function Button({ children, className, onClick, ...props }: ButtonProps) {
    return (
        <DevLinkButton className={className} onClick={onClick} {...props}>
            {children}
        </DevLinkButton>
    );
}
