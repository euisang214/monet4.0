import React from "react";
import { MetricCard } from "@/components/ui";

interface StatsCardProps {
    label: string;
    value: string | number;
    subValue?: string;
}

export function StatsCard({ label, value, subValue }: StatsCardProps) {
    return <MetricCard label={label} value={value} subValue={subValue} />;
}
