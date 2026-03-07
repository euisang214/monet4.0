import type { ToastCopy } from "@/components/ui/hooks/requestToastController";

export interface ProfessionalQcToastEvent {
    bookingId: string;
    candidateLabel: string;
    qcStatus: "passed" | "revise";
    qcReasons: string[];
    qcReviewedAt: string;
}

export function buildQcToastFingerprint(event: ProfessionalQcToastEvent) {
    return `${event.bookingId}:${event.qcStatus}:${event.qcReviewedAt}`;
}

export function getNextUnseenQcToastEvent(
    events: ProfessionalQcToastEvent[],
    seenFingerprints: Set<string>,
) {
    return events.find((event) => !seenFingerprints.has(buildQcToastFingerprint(event))) ?? null;
}

export function buildQcToastPresentation(event: ProfessionalQcToastEvent): {
    tone: "success" | "warning";
    copy: ToastCopy;
} {
    if (event.qcStatus === "passed") {
        return {
            tone: "success",
            copy: {
                title: "QC approved your feedback",
                message: `Feedback for ${event.candidateLabel} passed QC. Payout processing can continue.`,
            },
        };
    }

    const reasons = event.qcReasons.length > 0
        ? ` ${event.qcReasons.join(" ")}`
        : " Please revise the submission to meet QC standards.";

    return {
        tone: "warning",
        copy: {
            title: "QC requested a revision",
            message: `Feedback for ${event.candidateLabel} needs updates.${reasons}`,
            actionLabel: "Revise feedback",
            actionHref: `/professional/feedback/${event.bookingId}`,
        },
    };
}
