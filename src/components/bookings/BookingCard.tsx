"use client";

import React from "react";
import { Booking, BookingStatus } from "@prisma/client";

interface BookingCardProps {
    booking: Booking;
    onAction?: () => void;
    onRescheduleClick?: () => void;
}

const bookingDateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
});

function statusTone(status: BookingStatus) {
    if (status === BookingStatus.accepted || status === BookingStatus.completed) {
        return "bg-green-50 text-green-700";
    }
    if (status === BookingStatus.cancelled || status === BookingStatus.declined || status === BookingStatus.refunded) {
        return "bg-red-50 text-red-700";
    }
    if (status === BookingStatus.dispute_pending || status === BookingStatus.reschedule_pending) {
        return "bg-yellow-50 text-yellow-700";
    }
    return "bg-gray-100 text-gray-700";
}

export function BookingCard({ booking, onAction, onRescheduleClick }: BookingCardProps) {
    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format((booking.priceCents || 0) / 100);
    const formattedStartAt = booking.startAt ? bookingDateFormatter.format(new Date(booking.startAt)) : "Schedule pending";

    const canReschedule = booking.status === BookingStatus.accepted;

    return (
        <article className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Booking {booking.id.slice(0, 8)}...</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusTone(booking.status)}`}>
                    {booking.status.replace(/_/g, " ")}
                </span>
            </div>

            <p className="text-2xl font-bold text-gray-900 mb-2">{formattedPrice}</p>
            <p className="text-sm text-gray-500 mb-4">
                {formattedStartAt}
            </p>

            <div className="flex gap-2">
                {onAction && (
                    <button onClick={onAction} className="flex-1 bg-red-50 text-red-700 py-2 rounded-md hover:bg-red-100 transition-colors">
                        Cancel
                    </button>
                )}
                {canReschedule && onRescheduleClick && (
                    <button onClick={onRescheduleClick} className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-md hover:bg-blue-100 transition-colors">
                        Reschedule
                    </button>
                )}
            </div>
        </article>
    );
}
