"use client";

import { useEffect } from "react";
import { useTrackedRequest } from "@/components/ui/providers/RequestToastProvider";
import {
    buildQcToastFingerprint,
    buildQcToastPresentation,
    getNextUnseenQcToastEvent,
    type ProfessionalQcToastEvent,
} from "@/components/dashboard/professionalQcToastUtils";

const QC_TOAST_STORAGE_PREFIX = "monet-professional-qc-toast:";

interface ProfessionalQcToastEmitterProps {
    events: ProfessionalQcToastEvent[];
}

export function ProfessionalQcToastEmitter({ events }: ProfessionalQcToastEmitterProps) {
    const { showToast } = useTrackedRequest();

    useEffect(() => {
        if (typeof window === "undefined" || events.length === 0) {
            return;
        }

        const seenFingerprints = new Set(
            events
                .map((event) => buildQcToastFingerprint(event))
                .filter((fingerprint) => window.sessionStorage.getItem(`${QC_TOAST_STORAGE_PREFIX}${fingerprint}`)),
        );
        const nextEvent = getNextUnseenQcToastEvent(events, seenFingerprints);

        if (!nextEvent) {
            return;
        }

        const fingerprint = buildQcToastFingerprint(nextEvent);
        window.sessionStorage.setItem(`${QC_TOAST_STORAGE_PREFIX}${fingerprint}`, "shown");

        const presentation = buildQcToastPresentation(nextEvent);
        showToast(presentation.tone, presentation.copy);
    }, [events, showToast]);

    return null;
}
