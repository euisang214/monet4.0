import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/primitives/Button";

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
        <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex justify-between items-center gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">Feedback for {booking.candidateLabel}</h3>
                    {isRevision && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Revision</span>}
                </div>
                <p className="text-sm text-gray-600">Session completed on {dateStr}. Payout pending QC.</p>
            </div>

            <Link href={`/professional/feedback/${booking.id}`}>
                <Button className="bg-blue-600 text-white">{isRevision ? "Revise Feedback" : "Submit Feedback"}</Button>
            </Link>
        </article>
    );
}
