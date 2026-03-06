import React from "react";
import Link from "next/link";
import { StatusBadge, SurfaceCard } from "@/components/ui";
import { buttonVariants } from "@/components/ui/primitives/Button";

interface FeedbackTaskCardProps {
    booking: {
        id: string;
        candidateLabel: string;
        endAt: Date | null;
        feedback?: { qcStatus: string } | null;
    };
}

export function FeedbackTaskCard({ booking }: FeedbackTaskCardProps) {
    const isRevision = booking.feedback?.qcStatus === "revise";
    const dateStr = booking.endAt ? new Date(booking.endAt).toLocaleDateString() : "Unknown date";

    return (
        <SurfaceCard as="article" className="flex justify-between items-center gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">Feedback for {booking.candidateLabel}</h3>
                    {isRevision ? <StatusBadge label="Revision" variant="danger" /> : null}
                </div>
                <p className="text-sm text-gray-600">Session completed on {dateStr}. Payout pending QC.</p>
            </div>

            <Link href={`/professional/feedback/${booking.id}`} className={buttonVariants()}>
                {isRevision ? "Revise Feedback" : "Submit Feedback"}
            </Link>
        </SurfaceCard>
    );
}
