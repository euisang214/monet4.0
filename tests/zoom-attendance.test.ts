import { describe, expect, it } from 'vitest';

import { parseZoomAttendancePayload } from '@/lib/integrations/zoom-attendance';

describe('zoom-attendance helpers', () => {
    it('parses event_ts in seconds', () => {
        const parsed = parseZoomAttendancePayload({
            event_ts: 1_700_000_000,
            payload: {
                object: {
                    id: 'meeting_1',
                },
            },
        });

        expect(parsed.eventTs.toISOString()).toBe('2023-11-14T22:13:20.000Z');
    });

    it('parses event_ts in milliseconds', () => {
        const parsed = parseZoomAttendancePayload({
            event_ts: 1_700_000_000_000,
            payload: {
                object: {
                    id: 'meeting_1',
                },
            },
        });

        expect(parsed.eventTs.toISOString()).toBe('2023-11-14T22:13:20.000Z');
    });
});
