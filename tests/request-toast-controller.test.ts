import { describe, expect, it } from "vitest";
import {
    createRequestToastController,
    getToastAutoDismissMs,
} from "@/components/ui/hooks/requestToastController";

describe("requestToastController", () => {
    it("resolves same-page request success immediately", () => {
        const controller = createRequestToastController("/candidate/settings");
        const { requestId } = controller.startRequest({
            title: "Saving settings",
            message: "Updating your profile.",
        });

        expect(controller.getState()).toMatchObject({
            tone: "loading",
        });

        controller.resolveRequestSuccess(requestId, {
            title: "Settings saved",
            message: "Your changes are live.",
        });

        expect(controller.getState()).toMatchObject({
            tone: "success",
            copy: {
                title: "Settings saved",
            },
        });
    });

    it("resolves request errors without clearing the active toast slot", () => {
        const controller = createRequestToastController("/candidate/settings");
        const { requestId } = controller.startRequest({
            title: "Saving settings",
            message: "Updating your profile.",
        });

        controller.resolveRequestError(requestId, {
            title: "Save failed",
            message: "Please try again.",
        });

        expect(controller.getState()).toMatchObject({
            tone: "error",
            copy: {
                title: "Save failed",
            },
        });
    });

    it("waits for pathname changes before showing navigation success", () => {
        const controller = createRequestToastController("/candidate/bookings/booking-1/review");
        const { requestId } = controller.startRequest({
            title: "Submitting review",
            message: "Saving your review.",
        });

        controller.resolveRequestSuccess(
            requestId,
            {
                title: "Review submitted",
                message: "Your review is attached to the booking.",
            },
            "/candidate/bookings/booking-1",
        );

        expect(controller.getState()).toMatchObject({
            tone: "loading",
            pendingNavigationPath: "/candidate/bookings/booking-1",
        });

        controller.syncPathname("/candidate/bookings/booking-1");

        expect(controller.getState()).toMatchObject({
            tone: "success",
            copy: {
                title: "Review submitted",
            },
        });
    });

    it("ignores stale request completions when a newer request has already started", () => {
        const controller = createRequestToastController("/candidate/settings");
        const first = controller.startRequest({
            title: "Saving settings",
            message: "Updating your profile.",
        });
        const second = controller.startRequest({
            title: "Saving availability",
            message: "Updating your availability.",
        });

        controller.resolveRequestSuccess(first.requestId, {
            title: "Settings saved",
            message: "Your profile is live.",
        });

        expect(controller.getState()).toMatchObject({
            id: second.requestId,
            tone: "loading",
            copy: {
                title: "Saving availability",
            },
        });
    });

    it("dismisses the active toast", () => {
        const controller = createRequestToastController("/candidate/settings");
        controller.showToast("warning", {
            title: "Verification required",
            message: "Confirm your email first.",
        });

        expect(controller.getState()).not.toBeNull();

        controller.dismiss();

        expect(controller.getState()).toBeNull();
    });

    it("does not duplicate navigation success when the pathname is refreshed", () => {
        const controller = createRequestToastController("/professional/requests/booking-1");
        const { requestId } = controller.startRequest({
            title: "Confirming booking",
            message: "Scheduling this request.",
        });

        controller.resolveRequestSuccess(
            requestId,
            {
                title: "Booking confirmed",
                message: "Booking confirmed and scheduled.",
            },
            "/professional/dashboard",
        );
        controller.syncPathname("/professional/dashboard");

        const firstSuccessState = controller.getState();
        controller.syncPathname("/professional/dashboard");

        expect(controller.getState()).toEqual(firstSuccessState);
    });

    it("uses the agreed auto-dismiss timings", () => {
        expect(getToastAutoDismissMs("success")).toBe(4000);
        expect(getToastAutoDismissMs("warning")).toBe(6000);
        expect(getToastAutoDismissMs("error")).toBe(6000);
        expect(getToastAutoDismissMs("loading")).toBeNull();
    });
});
