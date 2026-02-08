"use client";

import React from "react";
import Link from "next/link";
import { Booking, BookingStatus, User } from "@prisma/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/primitives/Button";
import { appRoutes } from "@/lib/shared/routes";

interface RequestCardProps {
    booking: Booking & { candidate: User };
}

export function ProfessionalRequestCard({ booking }: RequestCardProps) {
    const isReschedule = booking.status === BookingStatus.reschedule_pending;
    const actionHref = isReschedule
        ? appRoutes.professional.requestReschedule(booking.id)
        : appRoutes.professional.requestConfirmAndSchedule(booking.id);
    const actionLabel = isReschedule ? "Review Reschedule" : "Review Request";
    const statusLabel = isReschedule ? "Reschedule Request" : "Pending Request";

    const price = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format((booking.priceCents || 0) / 100);

    return (
        <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex justify-between items-center gap-4">
            <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">{statusLabel}</p>
                <h4 className="font-semibold text-gray-900">{booking.candidate.email}</h4>
                <p className="text-sm text-gray-600">Consultation value {price}</p>
                {isReschedule ? (
                    <p className="text-xs text-gray-500 mt-2">Awaiting professional time selection</p>
                ) : (
                    <p className="text-xs text-gray-500 mt-2">
                        Expires {booking.expiresAt ? format(booking.expiresAt, "MMM d, yyyy") : "N/A"}
                    </p>
                )}
            </div>
            <Link href={actionHref}>
                <Button className="bg-blue-600 text-white">{actionLabel}</Button>
            </Link>
        </article>
    );
}
