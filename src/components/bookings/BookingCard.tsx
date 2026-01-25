"use client";

import React from "react";
import { Booking, BookingStatus } from "@prisma/client";
import { DevLinkBookingCard } from "@/devlink";

interface BookingCardProps {
    booking: Booking;
    onAction?: () => void;
    onRescheduleClick?: () => void;
}

export function BookingCard({ booking, onAction, onRescheduleClick }: BookingCardProps) {
    // Format price from cents to dollars
    const formattedPrice = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format((booking.priceCents || 0) / 100);

    // Reschedule is only available when booking is accepted
    const canReschedule = booking.status === BookingStatus.accepted;

    return (
        <div>
            <DevLinkBookingCard
                title={`Booking ${booking.id}`}
                price={formattedPrice}
                onCancelClick={onAction}
            />
            {canReschedule && onRescheduleClick && (
                <button
                    onClick={onRescheduleClick}
                    className="mt-2 bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                    Reschedule
                </button>
            )}
        </div>
    );
}
