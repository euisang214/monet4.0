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
                    id: "booking-requested-la",
                    status: BookingStatus.requested,
                    startAt: null,
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
    });
});
