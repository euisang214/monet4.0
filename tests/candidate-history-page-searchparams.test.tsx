import { beforeEach, describe, expect, it, vi } from "vitest";

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

import CandidateChatsPage from "@/app/candidate/history/page";

describe("CandidateChatsPage search params", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireRoleMock.mockResolvedValue({ id: "cand-1" });
        getCandidateChatSectionCountsMock.mockResolvedValue({
            upcoming: 0,
            pending: 0,
            expired: 0,
            past: 0,
            other: 0,
        });
        getCandidateChatSectionPageMock.mockResolvedValue({
            items: [],
            nextCursor: undefined,
        });
    });

    it("uses selected view from async searchParams", async () => {
        await CandidateChatsPage({
            searchParams: Promise.resolve({
                view: "pending",
                cursor: "cursor-123",
            }),
        });

        expect(getCandidateChatSectionPageMock).toHaveBeenCalledWith("cand-1", "pending", {
            cursor: "cursor-123",
        });
    });

    it("falls back to upcoming when view is invalid", async () => {
        await CandidateChatsPage({
            searchParams: Promise.resolve({
                view: "not-a-section",
                cursor: "cursor-456",
            }),
        });

        expect(getCandidateChatSectionPageMock).toHaveBeenCalledWith("cand-1", "upcoming", {
            cursor: "cursor-456",
        });
    });
});
