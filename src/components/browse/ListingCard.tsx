"use client";

import React from "react";
import { useRouter } from "next/navigation";

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
        <article className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Professional</div>
                    <h3 className="text-lg font-semibold text-gray-900">{professional.title}</h3>
                    <p className="text-sm text-gray-600">{professional.employer}</p>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold">{formattedPrice}</span>
            </div>

            <p className="text-sm text-gray-600 mb-6" style={{ minHeight: "3.5rem" }}>
                {professional.bio || "Career-focused 1:1 mentoring and guidance."}
            </p>

            <button
                onClick={() => router.push(`/candidate/professionals/${professional.userId}`)}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
                View Profile
            </button>
        </article>
    );
}
