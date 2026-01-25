import React from "react";

interface StatsCardProps {
    label: string;
    value: string | number;
    subValue?: string;
}

export function StatsCard({ label, value, subValue }: StatsCardProps) {
    return (
        <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">{label}</h3>
            <div className="mt-2 flex items-baseline">
                <span className="text-3xl font-semibold text-gray-900">{value}</span>
                {subValue && (
                    <span className="ml-2 text-sm text-gray-500">{subValue}</span>
                )}
            </div>
        </div>
    );
}
