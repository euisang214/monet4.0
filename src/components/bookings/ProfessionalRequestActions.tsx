"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/shared/routes";
import { Button, InlineNotice } from "@/components/ui";
import { buttonVariants } from "@/components/ui/primitives/Button";

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

            {error ? (
                <InlineNotice tone="error" title="Request update failed">
                    {error}
                </InlineNotice>
            ) : null}
        </div>
    );
}
