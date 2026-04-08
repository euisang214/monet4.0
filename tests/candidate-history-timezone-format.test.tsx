import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingStatus } from "@prisma/client";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getCandidateChatSectionCountsMock = vi.hoisted(() => vi.fn());
const getCandidateChatSectionPageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/core/api-helpers", () => ({
    requireRole: requireRoleMock,
}));

vi.mock("@/lib/role/candidate/chats", () => ({
    getCandidateChatSectionCounts: getCandidateChatSectionCountsMock,
    getCandidateChatSectionPage: getCandidateChatSectionPageMock,
}));

vi.mock("@/components/bookings/CandidateHistoryActions", () => ({
    CandidateHistoryActions: () => <div>mock-history-actions</div>,
}));

import CandidateChatsPage from "@/app/candidate/history/page";

describe("CandidateChatsPage timezone schedule labels", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireRoleMock.mockResolvedValue({ id: "cand-1" });
        getCandidateChatSectionCountsMock.mockResolvedValue({
            upcoming: 0,
            pending: 2,
            expired: 0,
            past: 0,
            other: 0,
        });
    });

    it("formats start and expiry labels in candidate timezone", async () => {
        getCandidateChatSectionPageMock.mockResolvedValue({
            items: [
                {
                    id: "booking-accepted-la",
                    status: BookingStatus.accepted,
                    startAt: new Date("2026-03-02T15:00:00Z"),
                    expiresAt: null,
                    timezone: "America/Los_Angeles",
                    professional: {
                        email: "pro-accepted@example.com",
                        firstName: "Avery",
                        lastName: "Stone",
                        professionalProfile: {
                            title: "VP",
                            employer: "Goldman Sachs",
                        },
                    },
                    feedback: null,
                    candidateZoomJoinUrl: null,
                    zoomJoinUrl: null,
                },
                {
                    id: "booking-expired-la",
                    status: BookingStatus.expired,
                    startAt: new Date("2026-03-06T16:00:00Z"),
                    expiresAt: new Date("2026-03-05T18:15:00Z"),
                    timezone: "America/Los_Angeles",
                    professional: {
                        email: "pro-expired@example.com",
                        firstName: "Jordan",
                        lastName: "Poe",
                        professionalProfile: {
                            title: "Associate",
                            employer: "Evercore",
                        },
                    },
                    feedback: null,
                    candidateZoomJoinUrl: null,
                    zoomJoinUrl: null,
                },
                {
                    id: "booking-declined-la",
                    status: BookingStatus.declined,
                    startAt: null,
                    expiresAt: new Date("2026-03-07T17:45:00Z"),
                    timezone: "America/Los_Angeles",
                    professional: {
                        email: "pro-declined@example.com",
                        firstName: "Morgan",
                        lastName: "Vale",
                        professionalProfile: {
                            title: "Manager",
                            employer: "Bain",
                        },
                    },
                    feedback: null,
                    candidateZoomJoinUrl: null,
                    zoomJoinUrl: null,
                },
                {
                    id: "booking-requested-la",
                    status: BookingStatus.requested,
                    startAt: new Date("2026-03-04T16:00:00Z"),
                    expiresAt: new Date("2026-03-03T19:30:00Z"),
                    timezone: "America/Los_Angeles",
                    professional: {
                        email: "pro-requested@example.com",
                        firstName: "Taylor",
                        lastName: "Quinn",
                        professionalProfile: {
                            title: "Consultant",
                            employer: "Bain",
                        },
                    },
                    feedback: null,
                    candidateZoomJoinUrl: null,
                    zoomJoinUrl: null,
                },
            ],
            nextCursor: undefined,
            candidateTimezone: "America/New_York",
        });

        const html = renderToStaticMarkup(
            await CandidateChatsPage({
                searchParams: Promise.resolve({
                    view: "pending",
                }),
            })
        );

        expect(html).toContain("Mar 2, 2026 at 10:00 AM (America/New_York)");
        expect(html).toContain("Request window ends Mar 3, 2026 at 2:30 PM (America/New_York)");
        expect(html).toContain("Request expired on Mar 5, 2026 at 1:15 PM (America/New_York)");
        expect(html).toContain("Request declined before a time was confirmed (America/New_York)");
        expect(html).not.toContain("Mar 4, 2026 at 11:00 AM (America/New_York)");
        expect(html).not.toContain("Mar 6, 2026 at 11:00 AM (America/New_York)");
        expect(html).not.toContain("Request window ends Mar 7, 2026 at 12:45 PM (America/New_York)");
    });
});
