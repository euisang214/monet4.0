import React from "react";
import { BookingStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const routerPushMock = vi.hoisted(() => vi.fn());
const routerRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: routerPushMock,
        refresh: routerRefreshMock,
    }),
}));

import { CandidateHistoryActions } from "@/components/bookings/CandidateHistoryActions";

describe("CandidateHistoryActions", () => {
    it("always renders View Booking and no Open chat label", () => {
        const html = renderToStaticMarkup(
            <CandidateHistoryActions
                bookingId="booking-1"
                status={BookingStatus.requested}
                joinUrl={null}
            />
        );

        expect(html).toContain("View Booking");
        expect(html).not.toContain("Open chat");
    });

    it("renders accepted booking actions based on status visibility", () => {
        const html = renderToStaticMarkup(
            <CandidateHistoryActions
                bookingId="booking-2"
                status={BookingStatus.accepted}
                joinUrl="https://zoom.us/j/123"
            />
        );

        expect(html).toContain("View Booking");
        expect(html).toContain("Join Zoom Call");
        expect(html).toContain("Reschedule");
        expect(html).toContain("Cancel Booking");
        expect(html).toContain("Report Issue");
        expect(html).not.toContain("Leave Review");
    });

    it("renders completed booking actions and omits inapplicable ones", () => {
        const html = renderToStaticMarkup(
            <CandidateHistoryActions
                bookingId="booking-3"
                status={BookingStatus.completed}
                joinUrl={null}
                hasFeedback
            />
        );

        expect(html).toContain("View Booking");
        expect(html).toContain("Report Issue");
        expect(html).toContain("Leave Review");
        expect(html).toContain("Feedback is available on the booking details page.");
        expect(html).not.toContain("Join Zoom Call");
        expect(html).not.toContain("Reschedule");
        expect(html).not.toContain("Cancel Booking");
    });
});
