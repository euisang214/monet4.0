import { BookingStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getCandidateBookingDetailsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/core/api-helpers", () => ({
    requireRole: requireRoleMock,
}));

vi.mock("@/lib/role/candidate/chats", () => ({
    getCandidateBookingDetails: getCandidateBookingDetailsMock,
}));

vi.mock("@/app/candidate/bookings/[id]/BookingActions", () => ({
    BookingActions: () => null,
}));

import BookingDetailsPage from "@/app/candidate/bookings/[id]/page";

const baseBooking = {
    id: "booking-1",
    status: BookingStatus.completed,
    priceCents: 12500,
    startAt: new Date("2026-02-20T16:00:00Z"),
    endAt: new Date("2026-02-20T16:30:00Z"),
    timezone: "America/New_York",
    professional: {
        email: "pro@example.com",
        professionalProfile: {
            title: "Engagement Manager",
            employer: "Acme Consulting",
        },
    },
    feedback: null,
};

describe("Candidate booking details feedback section", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireRoleMock.mockResolvedValue({ id: "cand-1" });
    });

    it("renders full feedback details for completed bookings with feedback", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            ...baseBooking,
            feedback: {
                text: "Strong session with clear structure and meaningful examples.",
                actions: [
                    "Refine your opening pitch for 90 seconds.",
                    "Practice two profitability drills before next week.",
                    "Build a concise story bank for behavioral interviews.",
                ],
                contentRating: 5,
                deliveryRating: 4,
                valueRating: 5,
                submittedAt: new Date("2026-02-21T10:00:00Z"),
            },
        });

        const html = renderToStaticMarkup(
            await BookingDetailsPage({
                params: Promise.resolve({ id: "booking-1" }),
            })
        );

        expect(html).toContain("Professional Feedback");
        expect(html).toContain("Written Feedback");
        expect(html).toContain("Action Items");
        expect(html).toContain("Ratings");
        expect(html).toContain("Strong session with clear structure and meaningful examples.");
        expect(html).toContain("Refine your opening pitch for 90 seconds.");
        expect(html).toContain("5/5");
        expect(html).toContain("4/5");
    });

    it("renders empty feedback notice for completed bookings without feedback", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            ...baseBooking,
            feedback: null,
        });

        const html = renderToStaticMarkup(
            await BookingDetailsPage({
                params: Promise.resolve({ id: "booking-1" }),
            })
        );

        expect(html).toContain("Professional Feedback");
        expect(html).toContain("Feedback is not available yet for this completed booking.");
    });

    it("does not render feedback section for non-completed bookings", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            ...baseBooking,
            status: BookingStatus.accepted,
            feedback: null,
        });

        const html = renderToStaticMarkup(
            await BookingDetailsPage({
                params: Promise.resolve({ id: "booking-1" }),
            })
        );

        expect(html).not.toContain("Professional Feedback");
        expect(html).not.toContain("Feedback is not available yet for this completed booking.");
    });
});
