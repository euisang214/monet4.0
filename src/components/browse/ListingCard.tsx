"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { formatRoleAtCompany } from "@/lib/domain/users/identity-labels";
import { formatProfessionalIndustry } from "@/lib/shared/professional-industries";
import { formatProfessionalSeniority } from "@/lib/shared/professional-seniority";
import { Button, SurfaceCard } from "@/components/ui";
import styles from "./ListingCard.module.css";

interface ListingCardProps {
    professional: {
        userId: string;
        title: string;
        employer: string;
        industry?: string | null;
        seniority?: string | null;
        priceCents: number;
        bio: string;
    };
}

export function ListingCard({ professional }: ListingCardProps) {
    const router = useRouter();
    const professionalLabel = formatRoleAtCompany(professional.title, professional.employer, "Professional");
    const industryLabel = formatProfessionalIndustry(professional.industry);
    const seniorityLabel = formatProfessionalSeniority(professional.seniority);
    const bioExcerpt = professional.bio?.trim() || "Career-focused 1:1 mentoring and guidance.";

    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format((professional.priceCents || 0) / 100);

    return (
        <SurfaceCard as="article" tone="accent" interactive className={styles.card}>
            <div className={styles.topline}>
                <p className={styles.eyebrow}>Curated mentor</p>
                <span className={styles.pricePill}>{formattedPrice} session</span>
            </div>

            <div className={styles.header}>
                <div className={styles.chips}>
                    {industryLabel ? <span className={styles.chip}>{industryLabel}</span> : null}
                    {seniorityLabel ? <span className={styles.chip}>{seniorityLabel}</span> : null}
                </div>

                <h4 className={styles.title}>{professionalLabel}</h4>
            </div>

            <p className={styles.bio}>{bioExcerpt}</p>

            <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Current focus</span>
                    <span className={styles.detailValue}>{industryLabel || "Career mentoring"}</span>
                </div>
                <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Experience level</span>
                    <span className={styles.detailValue}>{seniorityLabel || "Experienced professional"}</span>
                </div>
            </div>

            <div className={styles.footer}>
                <Button
                    onClick={() => router.push(`/candidate/professionals/${professional.userId}`)}
                >
                    View Profile
                </Button>
                <span className={styles.footerNote}>Secure booking flow</span>
            </div>
        </SurfaceCard>
    );
}
