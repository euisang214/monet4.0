import { describe, expect, it } from "vitest";
import {
    buildQcToastFingerprint,
    buildQcToastPresentation,
    getNextUnseenQcToastEvent,
    type ProfessionalQcToastEvent,
} from "@/components/dashboard/professionalQcToastUtils";

const baseEvent: ProfessionalQcToastEvent = {
    bookingId: "booking-1",
    candidateLabel: "Morgan Lee - Analyst @ Centerview",
    qcStatus: "revise",
    qcReasons: ["Word count is 120, minimum required is 200."],
    qcReviewedAt: "2026-03-07T12:00:00.000Z",
};

describe("professionalQcToastUtils", () => {
    it("builds a stable fingerprint from booking, status, and review timestamp", () => {
        expect(buildQcToastFingerprint(baseEvent)).toBe("booking-1:revise:2026-03-07T12:00:00.000Z");
    });

    it("selects the next unseen QC event by fingerprint", () => {
        const nextEvent = getNextUnseenQcToastEvent(
            [
                baseEvent,
                {
                    ...baseEvent,
                    bookingId: "booking-2",
                    qcStatus: "passed",
                    qcReviewedAt: "2026-03-07T10:00:00.000Z",
                    qcReasons: [],
                },
            ],
            new Set([buildQcToastFingerprint(baseEvent)]),
        );

        expect(nextEvent?.bookingId).toBe("booking-2");
    });

    it("builds a revise toast with action copy and reason details", () => {
        const presentation = buildQcToastPresentation(baseEvent);

        expect(presentation.tone).toBe("warning");
        expect(presentation.copy.actionHref).toBe("/professional/feedback/booking-1");
        expect(presentation.copy.message).toContain("needs updates");
        expect(presentation.copy.message).toContain("minimum required is 200");
    });

    it("builds a passed toast that confirms payout processing can continue", () => {
        const presentation = buildQcToastPresentation({
            ...baseEvent,
            qcStatus: "passed",
            qcReasons: [],
        });

        expect(presentation.tone).toBe("success");
        expect(presentation.copy.message).toContain("passed QC");
        expect(presentation.copy.actionHref).toBeUndefined();
    });
});
