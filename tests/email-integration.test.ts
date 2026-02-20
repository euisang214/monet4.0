import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

describe.sequential('Email integration', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        delete process.env.GMAIL_OAUTH_CLIENT_ID;
        delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
        delete process.env.GMAIL_OAUTH_REFRESH_TOKEN;
        delete process.env.GMAIL_OAUTH_USER;
        delete process.env.EMAIL_FROM;
        process.env['NODE_ENV'] = 'test';
    });

    afterEach(() => {
        vi.doUnmock('ics');
        process.env = { ...originalEnv };
    });

    it('omits ICS url when Zoom link is invalid or missing', async () => {
        const createEventMock = vi.fn().mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR' });
        vi.doMock('ics', () => ({
            createEvent: createEventMock,
        }));

        const { sendBookingAcceptedEmail } = await import('@/lib/integrations/email');
        await sendBookingAcceptedEmail({
            id: 'booking_1',
            startAt: new Date('2026-03-01T12:00:00Z'),
            endAt: new Date('2026-03-01T12:30:00Z'),
            zoomJoinUrl: 'link pending',
            candidate: { email: 'cand@example.com' },
            professional: { email: 'pro@example.com' },
        } as any, 'CANDIDATE');

        const eventArg = createEventMock.mock.calls[0][0];
        expect(eventArg.url).toBeUndefined();
        expect(eventArg.location).toBeUndefined();
    });

    it('includes ICS url when Zoom link is a valid absolute URL', async () => {
        const createEventMock = vi.fn().mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR' });
        vi.doMock('ics', () => ({
            createEvent: createEventMock,
        }));

        const { sendBookingAcceptedEmail } = await import('@/lib/integrations/email');
        await sendBookingAcceptedEmail({
            id: 'booking_2',
            startAt: new Date('2026-03-01T12:00:00Z'),
            endAt: new Date('2026-03-01T12:30:00Z'),
            zoomJoinUrl: 'https://zoom.us/j/123456',
            candidate: { email: 'cand@example.com' },
            professional: { email: 'pro@example.com' },
        } as any, 'PROFESSIONAL');

        const eventArg = createEventMock.mock.calls[0][0];
        expect(eventArg.url).toBe('https://zoom.us/j/123456');
        expect(eventArg.location).toBe('https://zoom.us/j/123456');
    });

    it('fails fast in production when required Gmail OAuth configuration is missing', async () => {
        process.env['NODE_ENV'] = 'production';
        delete process.env.GMAIL_OAUTH_CLIENT_ID;
        delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
        delete process.env.GMAIL_OAUTH_REFRESH_TOKEN;
        delete process.env.GMAIL_OAUTH_USER;
        delete process.env.EMAIL_FROM;

        await expect(import('@/lib/integrations/email')).rejects.toThrow('Missing Gmail OAuth email configuration');
    });
});
