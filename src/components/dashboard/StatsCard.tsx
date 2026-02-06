import React from "react";

interface StatsCardProps {
    label: string;
    value: string | number;
    subValue?: string;
}

export function StatsCard({ label, value, subValue }: StatsCardProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{label}</p>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900">{value}</span>
                {subValue && <span className="text-sm text-gray-500">{subValue}</span>}
            </div>
        </div>
    );
}
