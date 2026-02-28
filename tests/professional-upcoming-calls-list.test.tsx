import React from "react";
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

import { ProfessionalUpcomingCallsList } from "@/components/dashboard/ProfessionalUpcomingCallsList";

describe("ProfessionalUpcomingCallsList timezone formatting", () => {
    it("formats upcoming call time using booking timezone", () => {
        const html = renderToStaticMarkup(
            <ProfessionalUpcomingCallsList
                bookings={[
                    {
                        id: "booking-1",
                        startAt: new Date("2026-03-02T15:00:00Z"),
                        timezone: "America/Los_Angeles",
                        zoomJoinUrl: null,
                        professionalZoomJoinUrl: null,
                        candidateLabel: "Candidate One",
                    },
                ]}
            />
        );

        expect(html).toContain("Mar 2, 2026 at 7:00 AM (America/Los_Angeles)");
    });
});
