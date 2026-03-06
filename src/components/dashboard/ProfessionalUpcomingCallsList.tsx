"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/shared/routes";
import { formatInTimeZone } from "@/lib/utils/timezones";
import { normalizeTimezone } from "@/lib/utils/supported-timezones";
import { Button, InlineNotice, SurfaceCard } from "@/components/ui";

interface UpcomingCall {
    id: string;
    startAt: Date | string | null;
    timezone: string;
    zoomJoinUrl: string | null;
    professionalZoomJoinUrl: string | null;
    candidateLabel: string;
}

interface ProfessionalUpcomingCallsListProps {
    bookings: UpcomingCall[];
    professionalTimezone: string;
}

function formatCallTime(startAt: Date | string | null, resolvedTimezone: string) {
    if (!startAt) {
        return `Time TBD (${resolvedTimezone})`;
    }

    const parsed = startAt instanceof Date ? startAt : new Date(startAt);
    const dateTimeLabel = formatInTimeZone(parsed, resolvedTimezone, "MMM d, yyyy 'at' h:mm a");

    return `${dateTimeLabel} (${resolvedTimezone})`;
}

export function ProfessionalUpcomingCallsList({ bookings, professionalTimezone }: ProfessionalUpcomingCallsListProps) {
    const router = useRouter();
    const [pendingAction, setPendingAction] = useState<{ id: string; type: "cancel" | "reschedule" } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const displayTimezone = normalizeTimezone(professionalTimezone);

    const handleCancel = async (bookingId: string) => {
        const confirmed = window.confirm("Cancel this upcoming call?");
        if (!confirmed) {
            return;
        }

        setPendingAction({ id: bookingId, type: "cancel" });
        setError(null);

        try {
            const response = await fetch(appRoutes.api.shared.bookingCancel(bookingId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.error || "Failed to cancel booking.");
            }

            router.refresh();
        } catch (cancelError: unknown) {
            if (cancelError instanceof Error) {
                setError(cancelError.message);
            } else {
                setError("Failed to cancel booking.");
            }
        } finally {
            setPendingAction(null);
        }
    };

    const handleReschedule = async (bookingId: string) => {
        setPendingAction({ id: bookingId, type: "reschedule" });
        setError(null);

        try {
            const response = await fetch(appRoutes.api.professional.requestRescheduleRequest(bookingId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });

            const payload = (await response.json().catch(() => null)) as { error?: string } | null;
            if (!response.ok) {
                throw new Error(payload?.error || "Failed to request reschedule.");
            }

            router.push(appRoutes.professional.requestReschedule(bookingId));
        } catch (rescheduleError: unknown) {
            if (rescheduleError instanceof Error) {
                setError(rescheduleError.message);
            } else {
                setError("Failed to request reschedule.");
            }
        } finally {
            setPendingAction(null);
        }
    };

    const handleJoin = (zoomJoinUrl: string | null) => {
        if (!zoomJoinUrl) {
            return;
        }
        window.open(zoomJoinUrl, "_blank", "noopener,noreferrer");
    };

    return (
        <div className="space-y-3">
            {error ? (
                <InlineNotice tone="error" title="Action failed">
                    {error}
                </InlineNotice>
            ) : null}

            {bookings.map((booking) => {
                const cancelling = pendingAction?.id === booking.id && pendingAction.type === "cancel";
                const rescheduling = pendingAction?.id === booking.id && pendingAction.type === "reschedule";
                const joinUrl = booking.professionalZoomJoinUrl || booking.zoomJoinUrl;

                return (
                    <SurfaceCard key={booking.id} as="article">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="font-semibold text-gray-900">{booking.candidateLabel}</p>
                                <p className="text-sm text-gray-600">{formatCallTime(booking.startAt, displayTimezone)}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    onClick={() => handleCancel(booking.id)}
                                    disabled={Boolean(pendingAction)}
                                    variant="danger"
                                    size="sm"
                                    loading={cancelling}
                                    loadingLabel="Cancelling..."
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handleReschedule(booking.id)}
                                    disabled={Boolean(pendingAction)}
                                    variant="ghost"
                                    size="sm"
                                    loading={rescheduling}
                                    loadingLabel="Rescheduling..."
                                >
                                    Reschedule
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => handleJoin(joinUrl)}
                                    disabled={!joinUrl}
                                    size="sm"
                                >
                                    Join Zoom
                                </Button>
                            </div>
                        </div>
                    </SurfaceCard>
                );
            })}
        </div>
    );
}
