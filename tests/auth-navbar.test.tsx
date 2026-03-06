import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/candidate/bookings/booking-1"));
const useSessionMock = vi.hoisted(() => vi.fn(() => ({
    status: "authenticated",
    data: {
        user: {
            email: "candidate@example.com",
            role: "CANDIDATE",
            onboardingRequired: false,
            onboardingCompleted: true,
        },
    },
})));
const signOutMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
    usePathname: pathnameMock,
}));

vi.mock("next-auth/react", () => ({
    useSession: useSessionMock,
    signOut: signOutMock,
}));

import { AuthNavbar } from "@/components/layout/AuthNavbar";

describe("AuthNavbar", () => {
    it("renders the candidate account row and marks chats active for candidate booking routes", () => {
        const html = renderToStaticMarkup(<AuthNavbar />);

        expect(html).toContain("Monet");
        expect(html).toContain("candidate@example.com");
        expect(html).toContain("Log out");
        expect(html).toContain('aria-current="page"');
        expect(html).toContain(">Chats<");
    });
});
