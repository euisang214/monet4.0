"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { appRoutes } from "@/lib/shared/routes";
import { formatInTimeZone } from "@/lib/utils/timezones";
import { normalizeTimezone } from "@/lib/utils/supported-timezones";

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
}

function formatCallTime(startAt: Date | string | null, timezone: string) {
    const resolvedTimezone = normalizeTimezone(timezone);
    if (!startAt) {
        return `Time TBD (${resolvedTimezone})`;
    }

    const parsed = startAt instanceof Date ? startAt : new Date(startAt);
    const dateTimeLabel = formatInTimeZone(parsed, resolvedTimezone, "MMM d, yyyy 'at' h:mm a");

    return `${dateTimeLabel} (${resolvedTimezone})`;
}

export function ProfessionalUpcomingCallsList({ bookings }: ProfessionalUpcomingCallsListProps) {
    const router = useRouter();
    const [pendingAction, setPendingAction] = useState<{ id: string; type: "cancel" | "reschedule" } | null>(null);
    const [error, setError] = useState<string | null>(null);

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
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            ) : null}

            {bookings.map((booking) => {
                const cancelling = pendingAction?.id === booking.id && pendingAction.type === "cancel";
                const rescheduling = pendingAction?.id === booking.id && pendingAction.type === "reschedule";
                const joinUrl = booking.professionalZoomJoinUrl || booking.zoomJoinUrl;

                return (
                    <article key={booking.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <p className="font-semibold text-gray-900">{booking.candidateLabel}</p>
                                <p className="text-sm text-gray-600">{formatCallTime(booking.startAt, booking.timezone)}</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleCancel(booking.id)}
                                    disabled={Boolean(pendingAction)}
                                    className="btn border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {cancelling ? "Cancelling..." : "Cancel"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleReschedule(booking.id)}
                                    disabled={Boolean(pendingAction)}
                                    className="btn border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {rescheduling ? "Rescheduling..." : "Reschedule"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleJoin(joinUrl)}
                                    disabled={!joinUrl}
                                    className="btn bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Join Zoom
                                </button>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
