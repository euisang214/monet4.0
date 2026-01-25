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
    // Format price
    const price = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format((booking.priceCents || 0) / 100);

    // Format date if available (requests usually have a range, but Booking model has startAt... wait.
    // Booking request creates a booking with status 'requested'. 
    // Does it have startAt? 
    // CLAUDE.md Booking model: "startAt DateTime?". 
    // Usually requests are for a specific time OR just a "request" to book?
    // "Request (with payment authorization) -> Accept (captures funds) -> Schedule".
    // Ah, "Schedule" happens AFTER accept?
    // "Accept ... -> Schedule".
    // If so, `startAt` is null initially.
    // The request usually has "weeks" or metadata?
    // `createBookingRequest` in transitions takes "weeks". Audit log stores it. 
    // It seems the request is "I want to book you", time is decided later?
    // OR "Booking workflow: Request -> Accept -> Schedule". 
    // So YES, date is undecided.

    return (
        <div className="p-4 bg-white rounded-lg border border-gray-200 flex justify-between items-center">
            <div>
                <h4 className="font-semibold text-gray-900">Request from {booking.candidate.email}</h4>
                <p className="text-sm text-gray-500">Value: {price}</p>
                <p className="text-xs text-gray-400 mt-1">Expires {booking.expiresAt ? format(booking.expiresAt, 'MMM d, yyyy') : 'N/A'}</p>
            </div>
            <div className="flex gap-2">
                <Link href={`/professional/bookings/${booking.id}/confirm-and-schedule`}>
                    <Button className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Review Request</Button>
                </Link>
            </div>
        </div>
    );
}
