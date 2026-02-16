import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    neutral: 'bg-gray-100 text-gray-800',
};

interface StatusBadgeProps {
    label: string;
    variant: BadgeVariant;
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
    return (
        <span
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${VARIANT_CLASSES[variant]}`}
        >
            {label}
        </span>
    );
}
