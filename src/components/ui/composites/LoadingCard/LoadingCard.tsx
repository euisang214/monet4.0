import React from "react";
import { SurfaceCard } from "@/components/ui/composites/SurfaceCard/SurfaceCard";
import styles from "./LoadingCard.module.css";

interface LoadingCardProps {
    title?: string;
    description?: string;
    className?: string;
}

export function LoadingCard({ title = "Loading", description, className }: LoadingCardProps) {
    return (
        <SurfaceCard className={className}>
            <div className={styles.card} aria-live="polite" aria-busy="true" aria-label={description ? `${title}. ${description}` : title}>
                <span className={styles.heading} aria-hidden="true" />
                <span className={styles.line} aria-hidden="true" />
                <span className={styles.body} aria-hidden="true" />
            </div>
        </SurfaceCard>
    );
}
