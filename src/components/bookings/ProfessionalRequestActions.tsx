"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/shared/routes";

interface ProfessionalRequestActionsProps {
    bookingId: string;
    reviewHref: string;
    reviewLabel: string;
    resumeUrl?: string | null;
    isReschedule: boolean;
}

export function ProfessionalRequestActions({
    bookingId,
    reviewHref,
    reviewLabel,
    resumeUrl,
    isReschedule,
}: ProfessionalRequestActionsProps) {
    const router = useRouter();
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rejectLabel = isReschedule ? "Reject reschedule" : "Reject candidate";

    const handleReject = async () => {
        const confirmed = window.confirm(
            isReschedule
                ? "Reject this reschedule request?"
                : "Reject this candidate booking request?"
        );
        if (!confirmed) return;

        setIsRejecting(true);
        setError(null);

        try {
            const endpoint = isReschedule
                ? appRoutes.api.professional.requestRescheduleReject(bookingId)
                : appRoutes.api.professional.requestDecline(bookingId);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: isReschedule ? undefined : { "Content-Type": "application/json" },
                body: isReschedule ? undefined : JSON.stringify({ reason: "Declined by professional" }),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.error || "Failed to reject request");
            }

            router.refresh();
        } catch (rejectError: unknown) {
            if (rejectError instanceof Error) {
                setError(rejectError.message);
            } else {
                setError("Failed to reject request");
            }
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <div className="mt-4 space-y-2">
            <div className="flex gap-2 flex-wrap">
                <Link href={reviewHref} className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm">
                    {reviewLabel}
                </Link>

                {resumeUrl ? (
                    <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn bg-gray-100 text-gray-800 hover:bg-gray-200 text-sm"
                    >
                        View resume
                    </a>
                ) : (
                    <span className="btn bg-gray-100 text-gray-400 text-sm cursor-not-allowed">
                        Resume unavailable
                    </span>
                )}

                <button
                    type="button"
                    onClick={handleReject}
                    disabled={isRejecting}
                    className="btn bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-sm disabled:opacity-60"
                >
                    {isRejecting ? "Rejecting..." : rejectLabel}
                </button>
            </div>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </div>
    );
}
