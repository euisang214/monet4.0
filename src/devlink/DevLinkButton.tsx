import React from "react";

export function DevLinkButton({
    className,
    children,
    onClick,
}: {
    className?: string;
    children?: React.ReactNode;
    onClick?: (e?: any) => void;
}) {
    return (
        <button
            className={`bg-blue-500 text-white px-4 py-2 rounded ${className || ""}`}
            onClick={onClick}
        >
            {children || "Button"}
        </button>
    );
}
