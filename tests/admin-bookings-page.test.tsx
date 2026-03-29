import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const listBookingsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/role/admin/bookings", () => ({
    AdminBookingService: {
        listBookings: listBookingsMock,
    },
}));

vi.mock("@/app/admin/bookings/BookingSearch", () => ({
    default: () => <div>Booking search</div>,
}));

import BookingsPage from "@/app/admin/bookings/page";

describe("Admin bookings page", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        listBookingsMock.mockResolvedValue([
            {
                id: "booking_1234567890",
                startAt: new Date("2026-03-01T15:00:00.000Z"),
                status: "requested",
                candidateId: "candidate-1",
                professionalId: "professional-1",
                payment: {
                    status: "held",
                    amountGross: 12500,
                },
            },
        ]);
    });

    it("renders the admin landing table and action link without throwing", async () => {
        const view = await BookingsPage({ searchParams: { q: "" } });
        const html = renderToStaticMarkup(view);

        expect(html).toContain("Bookings");
        expect(html).toContain("Booking search");
        expect(html).toContain("candidate-1");
        expect(html).toContain("View");
    });
});
