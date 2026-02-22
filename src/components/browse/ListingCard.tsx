"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { formatRoleAtCompany } from "@/lib/domain/users/identity-labels";

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
        <article className="h-full bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow flex flex-col">
            <div className="mb-4">
                <div>
                    <h4 className="text-base font-semibold text-gray-900">{professionalLabel}</h4>
                </div>
            </div>

            <p className="text-sm text-gray-600" style={{ minHeight: "3.5rem" }}>
                {professional.bio || "Career-focused 1:1 mentoring and guidance."}
            </p>

            <div className="pt-6 flex items-center justify-between gap-4" style={{ marginTop: "auto" }}>
                <button
                    onClick={() => router.push(`/candidate/professionals/${professional.userId}`)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                    View Profile
                </button>
                <span className="ml-auto text-right text-lg font-semibold text-gray-900 whitespace-nowrap" style={{ lineHeight: 1 }}>
                    {formattedPrice}
                </span>
            </div>
        </article>
    );
}
