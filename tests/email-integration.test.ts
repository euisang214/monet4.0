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
        (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'test';
    });

    afterEach(() => {
        vi.doUnmock('ics');
        vi.doUnmock('nodemailer');
        vi.doUnmock('googleapis');
        process.env = { ...originalEnv };
    });

    it('fails fast in production when required Gmail OAuth configuration is missing', async () => {
        (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
        delete process.env.GMAIL_OAUTH_CLIENT_ID;
        delete process.env.GMAIL_OAUTH_CLIENT_SECRET;
        delete process.env.GMAIL_OAUTH_REFRESH_TOKEN;
        delete process.env.GMAIL_OAUTH_USER;
        delete process.env.EMAIL_FROM;

        await expect(import('@/lib/integrations/email')).rejects.toThrow('Missing Gmail OAuth email configuration');
    });

    it('sends iMIP REQUEST invite with private attendee metadata and role-specific meeting URL', async () => {
        process.env.GMAIL_OAUTH_CLIENT_ID = 'gmail-client';
        process.env.GMAIL_OAUTH_CLIENT_SECRET = 'gmail-secret';
        process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'gmail-refresh';
        process.env.GMAIL_OAUTH_USER = 'sender@example.com';
        process.env.EMAIL_FROM = 'Monet Platform <sender@example.com>';

        const createEventMock = vi.fn().mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR' });
        const sendMailMock = vi.fn().mockResolvedValue({});
        vi.doMock('ics', () => ({ createEvent: createEventMock }));
        vi.doMock('nodemailer', () => ({
            default: {
                createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
            },
        }));
        vi.doMock('googleapis', () => ({
            google: {
                auth: {
                    OAuth2: vi.fn(function OAuth2Mock() {
                        return {
                            setCredentials: vi.fn(),
                            getAccessToken: vi.fn().mockResolvedValue({ token: 'gmail-access-token' }),
                        };
                    }),
                },
            },
        }));

        const { sendCalendarInviteRequestEmail } = await import('@/lib/integrations/email');
        await sendCalendarInviteRequestEmail({
            id: 'booking_req_1',
            startAt: new Date('2026-03-01T12:00:00Z'),
            endAt: new Date('2026-03-01T12:30:00Z'),
            zoomJoinUrl: 'https://zoom.us/j/shared',
            candidateZoomJoinUrl: 'https://zoom.us/w/candidate123',
            professionalZoomJoinUrl: 'https://zoom.us/w/pro123',
            candidate: { email: 'cand@example.com', firstName: 'Cand', lastName: 'One' },
            professional: { email: 'pro@example.com', firstName: 'Pro', lastName: 'Two' },
        } as any, 'CANDIDATE', 'booking_req_1.candidate@monet.ai', 0, 'Join Zoom Meeting\nhttps://zoom.us/w/candidate123');

        const eventArg = createEventMock.mock.calls[0][0];
        expect(eventArg.method).toBe('REQUEST');
        expect(eventArg.uid).toBe('booking_req_1.candidate@monet.ai');
        expect(eventArg.sequence).toBe(0);
        expect(eventArg.attendees).toHaveLength(1);
        expect(eventArg.attendees[0].email).toBe('cand@example.com');
        expect(eventArg.location).toBe('https://zoom.us/w/candidate123');
        expect(eventArg.url).toBe('https://zoom.us/w/candidate123');
        expect(eventArg.organizer.email).toBe('sender@example.com');
        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            icalEvent: expect.objectContaining({
                method: 'REQUEST',
                content: 'BEGIN:VCALENDAR',
            }),
        }));
    });

    it('omits ICS url/location when the meeting URL is invalid', async () => {
        process.env.GMAIL_OAUTH_CLIENT_ID = 'gmail-client';
        process.env.GMAIL_OAUTH_CLIENT_SECRET = 'gmail-secret';
        process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'gmail-refresh';
        process.env.GMAIL_OAUTH_USER = 'sender@example.com';
        process.env.EMAIL_FROM = 'Monet Platform <sender@example.com>';

        const createEventMock = vi.fn().mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR' });
        const sendMailMock = vi.fn().mockResolvedValue({});
        vi.doMock('ics', () => ({ createEvent: createEventMock }));
        vi.doMock('nodemailer', () => ({
            default: {
                createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
            },
        }));
        vi.doMock('googleapis', () => ({
            google: {
                auth: {
                    OAuth2: vi.fn(function OAuth2Mock() {
                        return {
                            setCredentials: vi.fn(),
                            getAccessToken: vi.fn().mockResolvedValue({ token: 'gmail-access-token' }),
                        };
                    }),
                },
            },
        }));

        const { sendCalendarInviteRequestEmail } = await import('@/lib/integrations/email');
        await sendCalendarInviteRequestEmail({
            id: 'booking_req_invalid',
            startAt: new Date('2026-03-01T12:00:00Z'),
            endAt: new Date('2026-03-01T12:30:00Z'),
            zoomJoinUrl: 'link pending',
            candidate: { email: 'cand@example.com', firstName: 'Cand', lastName: 'One' },
            professional: { email: 'pro@example.com', firstName: 'Pro', lastName: 'Two' },
        } as any, 'CANDIDATE', 'booking_req_invalid.candidate@monet.ai', 0, 'Join Zoom Meeting\nlink pending');

        const eventArg = createEventMock.mock.calls[0][0];
        expect(eventArg.location).toBeUndefined();
        expect(eventArg.url).toBeUndefined();
        expect(sendMailMock).toHaveBeenCalledTimes(1);
    });

    it('falls back to GMAIL_OAUTH_USER for organizer when EMAIL_FROM is invalid', async () => {
        process.env.GMAIL_OAUTH_CLIENT_ID = 'gmail-client';
        process.env.GMAIL_OAUTH_CLIENT_SECRET = 'gmail-secret';
        process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'gmail-refresh';
        process.env.GMAIL_OAUTH_USER = 'oauth-sender@example.com';
        process.env.EMAIL_FROM = 'Monet Platform';

        const createEventMock = vi.fn().mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR' });
        const sendMailMock = vi.fn().mockResolvedValue({});
        vi.doMock('ics', () => ({ createEvent: createEventMock }));
        vi.doMock('nodemailer', () => ({
            default: {
                createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
            },
        }));
        vi.doMock('googleapis', () => ({
            google: {
                auth: {
                    OAuth2: vi.fn(function OAuth2Mock() {
                        return {
                            setCredentials: vi.fn(),
                            getAccessToken: vi.fn().mockResolvedValue({ token: 'gmail-access-token' }),
                        };
                    }),
                },
            },
        }));

        const { sendCalendarInviteRequestEmail } = await import('@/lib/integrations/email');
        await sendCalendarInviteRequestEmail({
            id: 'booking_req_organizer',
            startAt: new Date('2026-03-01T12:00:00Z'),
            endAt: new Date('2026-03-01T12:30:00Z'),
            zoomJoinUrl: 'https://zoom.us/j/shared',
            candidate: { email: 'cand@example.com', firstName: 'Cand', lastName: 'One' },
            professional: { email: 'pro@example.com', firstName: 'Pro', lastName: 'Two' },
        } as any, 'CANDIDATE', 'booking_req_organizer.candidate@monet.ai', 0, 'Join Zoom Meeting\nhttps://zoom.us/j/shared');

        const eventArg = createEventMock.mock.calls[0][0];
        expect(eventArg.organizer.email).toBe('oauth-sender@example.com');
        expect(sendMailMock).toHaveBeenCalledTimes(1);
    });

    it('sends iMIP CANCEL invite with incremented sequence', async () => {
        process.env.GMAIL_OAUTH_CLIENT_ID = 'gmail-client';
        process.env.GMAIL_OAUTH_CLIENT_SECRET = 'gmail-secret';
        process.env.GMAIL_OAUTH_REFRESH_TOKEN = 'gmail-refresh';
        process.env.GMAIL_OAUTH_USER = 'sender@example.com';
        process.env.EMAIL_FROM = 'Monet Platform <sender@example.com>';

        const createEventMock = vi.fn().mockReturnValue({ error: null, value: 'BEGIN:VCALENDAR' });
        const sendMailMock = vi.fn().mockResolvedValue({});
        vi.doMock('ics', () => ({ createEvent: createEventMock }));
        vi.doMock('nodemailer', () => ({
            default: {
                createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
            },
        }));
        vi.doMock('googleapis', () => ({
            google: {
                auth: {
                    OAuth2: vi.fn(function OAuth2Mock() {
                        return {
                            setCredentials: vi.fn(),
                            getAccessToken: vi.fn().mockResolvedValue({ token: 'gmail-access-token' }),
                        };
                    }),
                },
            },
        }));

        const { sendCalendarInviteCancelEmail } = await import('@/lib/integrations/email');
        await sendCalendarInviteCancelEmail({
            id: 'booking_req_1',
            startAt: new Date('2026-03-01T12:00:00Z'),
            endAt: new Date('2026-03-01T12:30:00Z'),
            zoomJoinUrl: 'https://zoom.us/j/shared',
            candidateZoomJoinUrl: 'https://zoom.us/w/candidate123',
            professionalZoomJoinUrl: 'https://zoom.us/w/pro123',
            candidate: { email: 'cand@example.com', firstName: 'Cand', lastName: 'One' },
            professional: { email: 'pro@example.com', firstName: 'Pro', lastName: 'Two' },
        } as any, 'CANDIDATE', 'booking_req_1.candidate@monet.ai', 3, 'Join Zoom Meeting\nhttps://zoom.us/w/candidate123');

        const eventArg = createEventMock.mock.calls[0][0];
        expect(eventArg.method).toBe('CANCEL');
        expect(eventArg.status).toBe('CANCELLED');
        expect(eventArg.sequence).toBe(3);
        expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
            icalEvent: expect.objectContaining({
                method: 'CANCEL',
                content: 'BEGIN:VCALENDAR',
            }),
        }));
    });
});
