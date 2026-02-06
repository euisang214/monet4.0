"use client";

import React from "react";
import Link from "next/link";
import { Booking, User } from "@prisma/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/Button";

interface RequestCardProps {
    booking: Booking & { candidate: User };
}

export function ProfessionalRequestCard({ booking }: RequestCardProps) {
    const price = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format((booking.priceCents || 0) / 100);

    return (
        <article className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex justify-between items-center gap-4">
            <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Pending Request</p>
                <h4 className="font-semibold text-gray-900">{booking.candidate.email}</h4>
                <p className="text-sm text-gray-600">Consultation value {price}</p>
                <p className="text-xs text-gray-500 mt-2">
                    Expires {booking.expiresAt ? format(booking.expiresAt, "MMM d, yyyy") : "N/A"}
                </p>
            </div>
            <Link href={`/professional/bookings/${booking.id}/confirm-and-schedule`}>
                <Button className="bg-blue-600 text-white">Review Request</Button>
            </Link>
        </article>
    );
}
