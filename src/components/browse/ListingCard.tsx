"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { formatRoleAtCompany } from "@/lib/domain/users/identity-labels";
import { Button, SurfaceCard } from "@/components/ui";
import styles from "./ListingCard.module.css";

interface ListingCardProps {
    professional: {
        userId: string;
        title: string;
        employer: string;
        priceCents: number;
        bio: string;
    };
}

export function ListingCard({ professional }: ListingCardProps) {
    const router = useRouter();
    const professionalLabel = formatRoleAtCompany(professional.title, professional.employer, "Professional");

    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
         maximumFractionDigits: 0,
    }).format((professional.priceCents || 0) / 100);

    return (
        <SurfaceCard as="article" tone="accent" interactive className={styles.card}>
            <div className={styles.header}>
                <p className={styles.eyebrow}>Curated mentor</p>
                <div>
                    <h4 className="text-base font-semibold text-gray-900">{professionalLabel}</h4>
                </div>
            </div>

            <p className={styles.bio}>
                {professional.bio || "Career-focused 1:1 mentoring and guidance."}
            </p>

            <div className={styles.footer}>
                <Button
                    onClick={() => router.push(`/candidate/professionals/${professional.userId}`)}
                >
                    View Profile
                </Button>
                <span className={styles.price}>
                    {formattedPrice}
                </span>
            </div>
        </SurfaceCard>
    );
}
