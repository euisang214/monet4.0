"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { buttonVariants } from "@/components/ui/primitives/Button";
import { useTrackedProfessionalBookingActions } from "@/components/bookings/hooks/useTrackedProfessionalBookingActions";

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
    const { rejectRequest } = useTrackedProfessionalBookingActions();
    const [isRejecting, setIsRejecting] = useState(false);

    const rejectLabel = isReschedule ? "Reject reschedule" : "Reject candidate";

    const handleReject = async () => {
        const confirmed = window.confirm(
            isReschedule
                ? "Reject this reschedule request?"
                : "Reject this candidate booking request?"
        );
        if (!confirmed) return;

        setIsRejecting(true);

        try {
            await rejectRequest({ bookingId, isReschedule });
        } catch {
            // Async failures are surfaced via tracked toast.
        } finally {
            setIsRejecting(false);
        }
    };

    return (
        <div className="mt-4 space-y-2">
            <div className="flex gap-2 flex-wrap">
                <Link href={reviewHref} className={buttonVariants({ size: "sm" })}>
                    {reviewLabel}
                </Link>

                {resumeUrl ? (
                    <a
                        href={resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={buttonVariants({ variant: "secondary", size: "sm" })}
                    >
                        View resume
                    </a>
                ) : (
                    <span className={buttonVariants({ variant: "secondary", size: "sm" })}>
                        Resume unavailable
                    </span>
                )}

                <Button
                    type="button"
                    onClick={handleReject}
                    disabled={isRejecting}
                    variant="danger"
                    size="sm"
                    loading={isRejecting}
                    loadingLabel="Rejecting..."
                >
                    {rejectLabel}
                </Button>
            </div>
        </div>
    );
}
