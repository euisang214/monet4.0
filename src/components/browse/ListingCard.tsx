"use client";

import React from "react";
import { useRouter } from "next/navigation";
// @ts-ignore - DevLink mock
import { DevLinkListingCard } from "@/devlink/DevLinkListingCard";

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

    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format((professional.priceCents || 0) / 100);

    return (
        <DevLinkListingCard
            name={professional.title} // Anonymized: show Title primarily
            title={`${professional.title} at ${professional.employer}`}
            price={formattedPrice}
            onViewProfileClick={() => router.push(`/candidate/professionals/${professional.userId}`)}
        />
    );
}
