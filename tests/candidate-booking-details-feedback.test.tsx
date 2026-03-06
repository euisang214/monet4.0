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
    timezone: "UTC",
    professional: {
        email: "pro@example.com",
        firstName: "Alex",
        lastName: "Morgan",
        professionalProfile: {
            title: "Engagement Manager",
            employer: "Acme Consulting",
        },
    },
    feedback: null,
};

const candidateTimezone = "America/New_York";

describe("Candidate booking details feedback section", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireRoleMock.mockResolvedValue({ id: "cand-1" });
    });

    it("renders full feedback details for completed bookings with feedback", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            booking: {
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
            },
            candidateTimezone,
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
        expect(html).toContain("Alex Morgan - Engagement Manager @ Acme Consulting");
        expect(html).toContain("Submitted February 21, 2026 at 5:00 AM");
        expect(html).toContain("February 20, 2026");
        expect(html).toContain("11:00 AM - 11:30 AM");
        expect(html).toContain(candidateTimezone);
    });

    it("renders empty feedback notice for completed bookings without feedback", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            booking: {
                ...baseBooking,
                feedback: null,
            },
            candidateTimezone,
        });

        const html = renderToStaticMarkup(
            await BookingDetailsPage({
                params: Promise.resolve({ id: "booking-1" }),
            })
        );

        expect(html).toContain("Professional Feedback");
        expect(html).toContain("Feedback is not available yet for this completed booking.");
        expect(html).toContain("Alex Morgan - Engagement Manager @ Acme Consulting");
    });

    it("does not render feedback section for non-completed bookings", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            booking: {
                ...baseBooking,
                status: BookingStatus.accepted,
                feedback: null,
            },
            candidateTimezone,
        });

        const html = renderToStaticMarkup(
            await BookingDetailsPage({
                params: Promise.resolve({ id: "booking-1" }),
            })
        );

        expect(html).not.toContain("Professional Feedback");
        expect(html).not.toContain("Feedback is not available yet for this completed booking.");
        expect(html).toContain("Alex Morgan - Engagement Manager @ Acme Consulting");
    });

    it("keeps professional header anonymized before acceptance lifecycle", async () => {
        getCandidateBookingDetailsMock.mockResolvedValue({
            booking: {
                ...baseBooking,
                status: BookingStatus.requested,
                feedback: null,
            },
            candidateTimezone,
        });

        const html = renderToStaticMarkup(
            await BookingDetailsPage({
                params: Promise.resolve({ id: "booking-1" }),
            })
        );

        expect(html).toContain("Engagement Manager @ Acme Consulting");
        expect(html).not.toContain("Alex Morgan - Engagement Manager @ Acme Consulting");
    });
});
