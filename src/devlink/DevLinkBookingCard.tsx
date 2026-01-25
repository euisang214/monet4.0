import React from "react";

export function DevLinkBookingCard({
    className,
    title = "Booking Title",
    price = "$0.00",
    onCancelClick,
}: {
    className?: string;
    title?: string;
    price?: string;
    onCancelClick?: () => void;
}) {
    return (
        <div className={`border p-4 rounded shadow ${className || ""}`}>
            <h3 className="font-bold">{title}</h3>
            <p className="text-gray-600">{price}</p>
            {onCancelClick && (
                <button
                    onClick={onCancelClick}
                    className="mt-2 bg-red-500 text-white px-2 py-1 rounded"
                >
                    Cancel
                </button>
            )}
        </div>
    );
}
