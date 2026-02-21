import { describe, expect, it, vi } from 'vitest';
import type { SlotInterval } from '@/components/bookings/calendar/types';
import {
    dispatchBestEffortAvailabilitySave,
} from '@/app/candidate/availability/CandidateAvailabilityEditor';
import {
    areSlotIntervalsEqual,
    buildAvailabilitySavePayload,
    splitSlotsByEditableWindow,
} from '@/components/bookings/calendar/interval-utils';
import { isInterceptableNavigation } from '@/app/candidate/availability/CandidateAvailabilityEditor';

function createAnchor(
    href: string,
    options?: {
        target?: string;
        hrefAttribute?: string | null;
        download?: boolean;
    }
): HTMLAnchorElement {
    return {
        href,
        target: options?.target || '',
        getAttribute: (name: string) => {
            if (name !== 'href') return null;
            return options?.hrefAttribute !== undefined ? options.hrefAttribute : href;
        },
        hasAttribute: (name: string) => name === 'download' && options?.download === true,
    } as unknown as HTMLAnchorElement;
}

describe('CandidateAvailabilityEditor helpers', () => {
    const editableStart = new Date('2026-02-21T10:00:00.000Z');
    const editableEnd = new Date('2026-03-23T10:00:00.000Z');

    it('splits slots into editable and preserved segments at the 30-day boundary', () => {
        const initialSlots: SlotInterval[] = [
            { start: '2026-02-21T09:30:00.000Z', end: '2026-02-21T10:30:00.000Z' },
            { start: '2026-03-23T09:30:00.000Z', end: '2026-03-23T11:00:00.000Z' },
            { start: '2026-03-24T11:00:00.000Z', end: '2026-03-24T12:00:00.000Z' },
        ];

        const result = splitSlotsByEditableWindow(initialSlots, editableStart, editableEnd);

        expect(result.editableSlots).toEqual([
            { start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T10:30:00.000Z' },
            { start: '2026-03-23T09:30:00.000Z', end: '2026-03-23T10:00:00.000Z' },
        ]);
        expect(result.preservedSlots).toEqual([
            { start: '2026-03-23T10:00:00.000Z', end: '2026-03-23T11:00:00.000Z' },
            { start: '2026-03-24T11:00:00.000Z', end: '2026-03-24T12:00:00.000Z' },
        ]);
    });

    it('builds save payload from edited in-window slots plus preserved >30-day slots', () => {
        const selectedEditableSlots: SlotInterval[] = [
            { start: '2026-02-21T10:30:00.000Z', end: '2026-02-21T12:00:00.000Z' },
        ];
        const baselineSlots: SlotInterval[] = [
            { start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' },
            { start: '2026-03-24T11:00:00.000Z', end: '2026-03-24T12:00:00.000Z' },
        ];

        const payload = buildAvailabilitySavePayload({
            selectedEditableSlots,
            baselineSlots,
            editableStart,
            editableEnd,
            timezone: 'America/Chicago',
        });

        expect(payload.timezone).toBe('America/Chicago');
        expect(payload.slots).toEqual([
            { start: '2026-02-21T10:30:00.000Z', end: '2026-02-21T12:00:00.000Z' },
            { start: '2026-03-24T11:00:00.000Z', end: '2026-03-24T12:00:00.000Z' },
        ]);
    });

    it('compares slot sets independent of ordering and overlap shape', () => {
        const left: SlotInterval[] = [
            { start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T10:30:00.000Z' },
            { start: '2026-02-21T10:30:00.000Z', end: '2026-02-21T11:00:00.000Z' },
        ];
        const right: SlotInterval[] = [
            { start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' },
        ];

        expect(areSlotIntervalsEqual(left, right)).toBe(true);
    });

    it('prefers sendBeacon and skips fetch fallback when beacon succeeds', () => {
        const sendBeacon = vi.fn().mockReturnValue(true);
        const fetchFn = vi.fn();

        const result = dispatchBestEffortAvailabilitySave(
            {
                slots: [{ start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' }],
                timezone: 'UTC',
            },
            {
                endpoint: '/api/candidate/availability',
                sendBeacon,
                fetchFn,
            }
        );

        expect(result).toBe('beacon');
        expect(sendBeacon).toHaveBeenCalledTimes(1);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('falls back to fetch keepalive when sendBeacon cannot queue', () => {
        const sendBeacon = vi.fn().mockReturnValue(false);
        const fetchFn = vi.fn().mockResolvedValue({ ok: true } as Response);

        const result = dispatchBestEffortAvailabilitySave(
            {
                slots: [{ start: '2026-02-21T10:00:00.000Z', end: '2026-02-21T11:00:00.000Z' }],
                timezone: 'UTC',
            },
            {
                endpoint: '/api/candidate/availability',
                sendBeacon,
                fetchFn,
            }
        );

        expect(result).toBe('fetch');
        expect(sendBeacon).toHaveBeenCalledTimes(1);
        expect(fetchFn).toHaveBeenCalledWith(
            '/api/candidate/availability',
            expect.objectContaining({
                method: 'POST',
                keepalive: true,
            })
        );
    });

    it('flags only same-origin anchors as interceptable navigation', () => {
        const currentHref = 'https://app.local/candidate/availability';

        const sameOriginAnchor = createAnchor('https://app.local/candidate/settings');
        const externalAnchor = createAnchor('https://other.local/candidate/settings');
        const newTabAnchor = createAnchor('https://app.local/candidate/settings', { target: '_blank' });
        const hashAnchor = createAnchor('https://app.local/candidate/availability#details', { hrefAttribute: '#details' });

        expect(isInterceptableNavigation(sameOriginAnchor, currentHref)).toBe(true);
        expect(isInterceptableNavigation(externalAnchor, currentHref)).toBe(false);
        expect(isInterceptableNavigation(newTabAnchor, currentHref)).toBe(false);
        expect(isInterceptableNavigation(hashAnchor, currentHref)).toBe(false);
    });
});
