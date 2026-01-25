import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface FeedbackTaskCardProps {
    booking: {
        id: string;
        candidate: { email: string };
        endAt: Date | null;
        feedback?: { qcStatus: string } | null;
    };
}

export function FeedbackTaskCard({ booking }: FeedbackTaskCardProps) {
    const isRevision = booking.feedback?.qcStatus === "revise";
    const dateStr = booking.endAt ? new Date(booking.endAt).toLocaleDateString() : "Unknown date";

    return (
        <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                        Feedback for {booking.candidate.email}
                    </h3>
                    {isRevision && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Revision Requested
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-500">
                    Call completed on {dateStr}. Payout pending feedback.
                </p>
                {isRevision && (
                    <p className="text-xs text-red-600 mt-1">
                        Your previous feedback requires changes. Check your email for details.
                    </p>
                )}
            </div>

            <div className="flex-shrink-0">
                <Link href={`/professional/feedback/${booking.id}`}>
                    <Button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm">
                        {isRevision ? "Revise Feedback" : "Give Feedback"}
                    </Button>
                </Link>
            </div>
        </div>
    );
}
