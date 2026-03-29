'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays } from 'date-fns';
import { useRouter } from 'next/navigation';
import { CandidateAvailabilityPanel } from '@/components/bookings/CandidateAvailabilityPanel';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import { AVAILABILITY_WINDOW_DAYS, roundUpToNextSlot } from '@/components/bookings/calendar/slot-utils';
import {
    areSlotIntervalsEqual,
    buildAvailabilitySavePayload,
    mergeSlotIntervals,
    splitSlotsByEditableWindow,
} from '@/components/bookings/calendar/interval-utils';
import { appRoutes } from '@/lib/shared/routes';
import { Button, SurfaceCard } from '@/components/ui';
import { useTrackedRequest } from '@/components/ui/providers/RequestToastProvider';
import { executeTrackedAction } from '@/components/ui/actions/executeTrackedAction';
import { buildErrorToastCopy } from '@/components/ui/hooks/requestToastController';

interface CandidateAvailabilityEditorProps {
    initialAvailabilitySlots: SlotInterval[];
    calendarTimezone?: string | null;
    isGoogleCalendarConnected: boolean;
}

function closestAnchorTarget(target: EventTarget | null): HTMLAnchorElement | null {
    if (!(target instanceof Element)) return null;
    const anchor = target.closest('a[href]');
    return anchor instanceof HTMLAnchorElement ? anchor : null;
}

export function isInterceptableNavigation(anchor: HTMLAnchorElement, currentHref: string = window.location.href): boolean {
    if (anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;

    const rawHref = anchor.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) {
        return false;
    }

    const currentUrl = new URL(currentHref);
    const destination = new URL(anchor.href, currentUrl.href);
    return destination.origin === currentUrl.origin && destination.href !== currentUrl.href;
}

interface DispatchBestEffortSaveOptions {
    endpoint?: string;
    sendBeacon?: (url: string, data?: BodyInit | null) => boolean;
    fetchFn?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export function dispatchBestEffortAvailabilitySave(
    payload: { slots: SlotInterval[]; timezone: string },
    options: DispatchBestEffortSaveOptions = {}
): 'beacon' | 'fetch' | 'skipped' {
    const endpoint = options.endpoint || appRoutes.api.candidate.availability;
    const body = JSON.stringify(payload);

    if (options.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        const queued = options.sendBeacon(endpoint, blob);
        if (queued) {
            return 'beacon';
        }
    }

    if (options.fetchFn) {
        void options.fetchFn(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            keepalive: true,
        });
        return 'fetch';
    }

    return 'skipped';
}

export function CandidateAvailabilityEditor({
    initialAvailabilitySlots,
    calendarTimezone,
    isGoogleCalendarConnected,
}: CandidateAvailabilityEditorProps) {
    const router = useRouter();
    const { runTrackedRequest } = useTrackedRequest();
    const trackedRuntime = useMemo(
        () => ({
            runTrackedRequest,
            push: router.push,
            replace: router.replace,
            refresh: router.refresh,
        }),
        [router, runTrackedRequest]
    );
    const resolvedCalendarTimezone = React.useMemo(
        () => calendarTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        [calendarTimezone]
    );
    const editableStart = useMemo(() => roundUpToNextSlot(new Date()), []);
    const editableEnd = useMemo(() => addDays(editableStart, AVAILABILITY_WINDOW_DAYS), [editableStart]);
    const initialMergedSlots = useMemo(
        () => mergeSlotIntervals(initialAvailabilitySlots),
        [initialAvailabilitySlots]
    );
    const initialEditableSlots = useMemo(
        () => splitSlotsByEditableWindow(initialMergedSlots, editableStart, editableEnd).editableSlots,
        [editableEnd, editableStart, initialMergedSlots]
    );

    const [baselineSlots, setBaselineSlots] = useState<SlotInterval[]>(() => initialMergedSlots);
    const [selectedEditableSlots, setSelectedEditableSlots] = useState<SlotInterval[]>(() => initialEditableSlots);
    const [isSaving, setIsSaving] = useState(false);

    const latestSelectedSlotsRef = useRef<SlotInterval[]>(selectedEditableSlots);
    const baselineSlotsRef = useRef<SlotInterval[]>(baselineSlots);
    const isSavingRef = useRef(false);

    const baselineEditableSlots = useMemo(
        () => splitSlotsByEditableWindow(baselineSlots, editableStart, editableEnd).editableSlots,
        [baselineSlots, editableEnd, editableStart]
    );
    const preservedSlotCount = useMemo(
        () => splitSlotsByEditableWindow(baselineSlots, editableStart, editableEnd).preservedSlots.length,
        [baselineSlots, editableEnd, editableStart]
    );
    const hasUnsavedChanges = useMemo(
        () => !areSlotIntervalsEqual(selectedEditableSlots, baselineEditableSlots),
        [baselineEditableSlots, selectedEditableSlots]
    );
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

    useEffect(() => {
        latestSelectedSlotsRef.current = selectedEditableSlots;
    }, [selectedEditableSlots]);

    useEffect(() => {
        baselineSlotsRef.current = baselineSlots;
    }, [baselineSlots]);

    useEffect(() => {
        isSavingRef.current = isSaving;
    }, [isSaving]);

    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);

    useEffect(() => {
        if (hasUnsavedChangesRef.current || isSavingRef.current) return;
        setBaselineSlots(initialMergedSlots);
        setSelectedEditableSlots(initialEditableSlots);
    }, [initialEditableSlots, initialMergedSlots]);

    const createSavePayload = useCallback(
        (
            selectedSlots: SlotInterval[] = latestSelectedSlotsRef.current,
            currentBaseline: SlotInterval[] = baselineSlotsRef.current
        ) =>
            buildAvailabilitySavePayload({
                selectedEditableSlots: selectedSlots,
                baselineSlots: currentBaseline,
                editableStart,
                editableEnd,
                timezone: resolvedCalendarTimezone,
            }),
        [editableEnd, editableStart, resolvedCalendarTimezone]
    );

    const saveAvailabilityWithToast = useCallback(async (navigationHref?: string): Promise<boolean> => {
        if (!hasUnsavedChangesRef.current) {
            return true;
        }
        if (isSavingRef.current) {
            return false;
        }

        setIsSaving(true);
        isSavingRef.current = true;

        const payload = createSavePayload();

        try {
            await executeTrackedAction(trackedRuntime, {
                action: async () => {
                    const response = await fetch(appRoutes.api.candidate.availability, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    if (!response.ok) {
                        const errorPayload = await response.json().catch(() => null) as { error?: string } | null;
                        throw new Error(errorPayload?.error || 'Failed to save availability.');
                    }

                    const nextBaseline = mergeSlotIntervals(payload.slots);
                    setBaselineSlots(nextBaseline);
                    return true;
                },
                copy: {
                    pending: {
                        title: 'Saving availability',
                        message: navigationHref
                            ? 'Saving your availability before leaving this page.'
                            : 'Updating your availability.',
                    },
                    success: {
                        title: 'Availability saved',
                        message: navigationHref
                            ? 'Your availability was saved and the next page is ready.'
                            : 'Your availability has been updated.',
                    },
                    error: (error) => buildErrorToastCopy(error, 'Availability save failed'),
                },
                postSuccess: navigationHref
                    ? {
                          kind: 'push',
                          href: navigationHref,
                      }
                    : { kind: 'refresh' },
            });
            return true;
        } catch {
            return false;
        } finally {
            setIsSaving(false);
            isSavingRef.current = false;
        }
    }, [createSavePayload, trackedRuntime]);

    const sendBestEffortSave = useCallback(() => {
        if (!hasUnsavedChangesRef.current || isSavingRef.current) return;

        const payload = createSavePayload();
        dispatchBestEffortAvailabilitySave(payload, {
            sendBeacon:
                typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
                    ? navigator.sendBeacon.bind(navigator)
                    : undefined,
            fetchFn: typeof fetch === 'function' ? fetch : undefined,
        });
    }, [createSavePayload]);

    const handleSlotSelectionChange = useCallback(
        ({ availabilitySlots }: { availabilitySlots: SlotInterval[]; selectedCount: number }) => {
            setSelectedEditableSlots(availabilitySlots);
        },
        []
    );

    useEffect(() => {
        const handlePageHide = () => {
            sendBestEffortSave();
        };

        window.addEventListener('pagehide', handlePageHide);
        return () => window.removeEventListener('pagehide', handlePageHide);
    }, [sendBestEffortSave]);

    useEffect(() => {
        const handleClickCapture = (event: MouseEvent) => {
            if (!hasUnsavedChangesRef.current || isSavingRef.current) return;
            if (event.defaultPrevented || event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const anchor = closestAnchorTarget(event.target);
            if (!anchor || !isInterceptableNavigation(anchor)) return;

            const destination = new URL(anchor.href, window.location.href);
            event.preventDefault();
            event.stopPropagation();

            void (async () => {
                const nextHref = `${destination.pathname}${destination.search}${destination.hash}`;
                const saved = await saveAvailabilityWithToast(nextHref);
                if (saved) {
                    return;
                }
            })();
        };

        document.addEventListener('click', handleClickCapture, true);
        return () => document.removeEventListener('click', handleClickCapture, true);
    }, [saveAvailabilityWithToast]);

    return (
        <SurfaceCard className="space-y-6">
            <CandidateAvailabilityPanel
                calendarTimezone={resolvedCalendarTimezone}
                isGoogleCalendarConnected={isGoogleCalendarConnected}
                initialSelectedSlots={initialEditableSlots}
                onSelectionChange={handleSlotSelectionChange}
                selectedCountLabel="Selected candidate slots"
            />

            {preservedSlotCount > 0 && (
                <p className="text-xs text-gray-500 mb-4">
                    {preservedSlotCount} future slot{preservedSlotCount === 1 ? '' : 's'} beyond this 30-day window will be preserved.
                </p>
            )}

            <div className="pt-4 border-t flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-gray-600">
                    {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
                </span>
                <Button
                    type="button"
                    onClick={() => void saveAvailabilityWithToast()}
                    disabled={!hasUnsavedChanges || isSaving}
                    loading={isSaving}
                    loadingLabel="Saving..."
                >
                    Save availability
                </Button>
            </div>
        </SurfaceCard>
    );
}
