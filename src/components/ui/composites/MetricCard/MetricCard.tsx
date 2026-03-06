import React from "react";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";
import styles from "./MetricCard.module.css";

interface MetricCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    className?: string;
}

export function MetricCard({ label, value, subValue, className }: MetricCardProps) {
    return (
        <SurfaceCard className={className} tone="accent">
            <div className={styles.metric}>
                <p className={styles.label}>{label}</p>
                <div className={styles.valueRow}>
                    <span className={styles.value}>{value}</span>
                    {subValue ? <span className={styles.subValue}>{subValue}</span> : null}
                </div>
            </div>
        </SurfaceCard>
    );
}
