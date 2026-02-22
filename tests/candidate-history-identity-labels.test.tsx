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

describe("CandidateChatsPage identity labels", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireRoleMock.mockResolvedValue({ id: "cand-1" });
        getCandidateChatSectionCountsMock.mockResolvedValue({
            upcoming: 1,
            pending: 1,
            expired: 0,
            past: 0,
            other: 0,
        });
    });

    it("renders title/company before reveal statuses and full identity after reveal statuses", async () => {
        getCandidateChatSectionPageMock.mockResolvedValue({
            items: [
                {
                    id: "booking-requested",
                    status: BookingStatus.requested,
                    startAt: null,
                    expiresAt: new Date("2026-03-01T10:00:00Z"),
                    timezone: "America/New_York",
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
                {
                    id: "booking-accepted",
                    status: BookingStatus.accepted,
                    startAt: new Date("2026-03-02T15:00:00Z"),
                    expiresAt: null,
                    timezone: "America/New_York",
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
            ],
            nextCursor: undefined,
        });

        const html = renderToStaticMarkup(
            await CandidateChatsPage({
                searchParams: Promise.resolve({
                    view: "pending",
                }),
            })
        );

        expect(html).toContain("Consultant @ Bain");
        expect(html).not.toContain("Taylor Quinn - Consultant @ Bain");
        expect(html).toContain("Avery Stone - VP @ Goldman Sachs");
        expect(html).not.toContain("pro-requested@example.com");
        expect(html).not.toContain("pro-accepted@example.com");
    });
});
