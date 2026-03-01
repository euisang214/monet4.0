import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.hoisted(() => vi.fn());
const getDashboardDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/core/api-helpers", () => ({
    requireRole: requireRoleMock,
}));

vi.mock("@/lib/role/professional/dashboard", () => ({
    ProfessionalDashboardService: {
        getDashboardData: getDashboardDataMock,
    },
}));

import ProfessionalDashboardPage from "@/app/professional/dashboard/page";

describe("ProfessionalDashboardPage search params", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireRoleMock.mockResolvedValue({ id: "pro-1" });
        getDashboardDataMock.mockResolvedValue({
            stats: { upcomingBookingsCount: 0, pendingFeedbackCount: 0 },
            sectionCounts: {
                upcoming: 0,
                requested: 0,
                reschedule: 0,
                pending_feedback: 0,
            },
            items: [],
            nextCursor: undefined,
            professionalTimezone: "UTC",
            recentFeedback: [],
            reviewStats: { average: null, count: 0 },
        });
    });

    it("uses the selected view from async searchParams", async () => {
        await ProfessionalDashboardPage({
            searchParams: Promise.resolve({
                view: "requested",
                cursor: "cursor-123",
            }),
        });

        expect(getDashboardDataMock).toHaveBeenCalledWith("pro-1", {
            view: "requested",
            cursor: "cursor-123",
        });
    });

    it("falls back to upcoming when view is invalid", async () => {
        await ProfessionalDashboardPage({
            searchParams: Promise.resolve({
                view: "unknown-view",
                cursor: "cursor-456",
            }),
        });

        expect(getDashboardDataMock).toHaveBeenCalledWith("pro-1", {
            view: "upcoming",
            cursor: "cursor-456",
        });
    });
});
