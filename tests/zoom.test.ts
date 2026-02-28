import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Zoom Integration Tests (CLAUDE.md referenced)
 * 
 * Tests the Zoom integration module for:
 * - Token caching and refresh
 * - Meeting creation
 * - Meeting deletion idempotency
 */

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock prisma
vi.mock('@/lib/core/db', () => ({
    prisma: {
        booking: { findUnique: vi.fn() },
    },
}));

describe('Zoom Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset any cached tokens by clearing module state
        vi.resetModules();
    });

    describe('Token Management', () => {
        it('should request token with correct OAuth credentials', async () => {
            // Mock successful token response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'zoom_token_123',
                    expires_in: 3600,
                }),
            });

            // Import fresh module (env vars set)
            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { getZoomAccessToken } = await import('@/lib/integrations/zoom');
            const token = await getZoomAccessToken();

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('zoom.us/oauth/token'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: expect.stringContaining('Basic'),
                    }),
                })
            );
            expect(token).toBe('zoom_token_123');
        });

        it('should cache token and reuse until near expiry', async () => {
            // First call gets new token
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    access_token: 'cached_token',
                    expires_in: 3600, // 1 hour
                }),
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { getZoomAccessToken } = await import('@/lib/integrations/zoom');

            // First call
            await getZoomAccessToken();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Second call should use cached token
            await getZoomAccessToken();
            expect(mockFetch).toHaveBeenCalledTimes(1); // No additional call
        });
    });

    describe('Meeting Creation', () => {
        it('should create meeting with correct parameters', async () => {
            // Token request
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 }),
            });

            // Meeting creation request
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 12345,
                    join_url: 'https://zoom.us/j/12345',
                    start_url: 'https://zoom.us/s/12345',
                    password: 'abc123',
                }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'registrant_candidate',
                    join_url: 'https://zoom.us/w/candidate123',
                }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 'registrant_professional',
                    join_url: 'https://zoom.us/w/professional123',
                }),
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { createZoomMeeting } = await import('@/lib/integrations/zoom');

            const result = await createZoomMeeting({
                topic: 'Mock Interview',
                start_time: new Date('2026-01-26T10:00:00Z'),
                duration: 60,
                timezone: 'UTC',
                agenda: 'Test meeting',
                candidateEmail: 'candidate@monet.local',
                professionalEmail: 'professional@monet.local',
            });

            expect(result.join_url).toBe('https://zoom.us/j/12345');
            expect(result.id).toBe(12345);
            expect(result.candidate_join_url).toBe('https://zoom.us/w/candidate123');
            expect(result.professional_join_url).toBe('https://zoom.us/w/professional123');

            const createMeetingBody = JSON.parse(mockFetch.mock.calls[1][1].body);
            expect(createMeetingBody.settings.registrants_confirmation_email).toBe(false);
            expect(createMeetingBody.settings.registrants_email_notification).toBe(false);

            // Check meeting creation call
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.zoom.us/v2/users/me/meetings',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        Authorization: 'Bearer token',
                        'Content-Type': 'application/json',
                    }),
                })
            );
            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.zoom.us/v2/meetings/12345/registrants',
                expect.objectContaining({
                    method: 'POST',
                })
            );
        });

        it('should throw on meeting creation failure', async () => {
            // Token request
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 }),
            });

            // Meeting creation fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ code: 400, message: 'Bad Request' }),
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { createZoomMeeting } = await import('@/lib/integrations/zoom');

            await expect(createZoomMeeting({
                topic: 'Test',
                start_time: new Date(),
                duration: 30,
                candidateEmail: 'candidate@monet.local',
                professionalEmail: 'professional@monet.local',
            })).rejects.toThrow('Zoom Create Meeting Failed');
        });
    });

    describe('Meeting Deletion', () => {
        it('should delete meeting successfully', async () => {
            // Token
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 }),
            });

            // Delete request (204 success, no body)
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { deleteZoomMeeting } = await import('@/lib/integrations/zoom');

            // Should not throw
            await expect(deleteZoomMeeting('12345')).resolves.toBeUndefined();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.zoom.us/v2/meetings/12345',
                expect.objectContaining({ method: 'DELETE' })
            );
        });

        it('should be idempotent - not throw on 404', async () => {
            // Token
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 }),
            });

            // Delete returns 404 (meeting already deleted)
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { deleteZoomMeeting } = await import('@/lib/integrations/zoom');

            // Should NOT throw - 404 is acceptable (idempotent)
            await expect(deleteZoomMeeting('nonexistent')).resolves.toBeUndefined();
        });
    });

    describe('Invitation Content', () => {
        it('should return native invitation text when endpoint is available', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    invitation: 'Join Zoom Meeting\nhttps://zoom.us/j/12345',
                }),
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { getZoomInvitationContent } = await import('@/lib/integrations/zoom');
            const invitation = await getZoomInvitationContent({
                meetingId: '12345',
                preferredJoinUrl: 'https://zoom.us/w/role-specific',
            });

            expect(invitation.source).toBe('native');
            expect(invitation.text).toContain('https://zoom.us/w/role-specific');
            expect(invitation.text).toContain('Join Zoom Meeting');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should fall back to generated invitation text when native endpoint fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ access_token: 'token', expires_in: 3600 }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ code: 404, message: 'Not found' }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    id: 12345,
                    join_url: 'https://zoom.us/j/12345',
                    password: 'abc123',
                    settings: {
                        global_dial_in_numbers: [
                            { country_name: 'US', number: '+1 123-456-7890' },
                        ],
                        global_dial_in_url: 'https://zoom.us/u/abc',
                    },
                }),
            });

            vi.stubEnv('ZOOM_ACCOUNT_ID', 'test_account');
            vi.stubEnv('ZOOM_CLIENT_ID', 'test_client');
            vi.stubEnv('ZOOM_CLIENT_SECRET', 'test_secret');

            const { getZoomInvitationContent } = await import('@/lib/integrations/zoom');
            const invitation = await getZoomInvitationContent({
                meetingId: 12345,
                preferredJoinUrl: 'https://zoom.us/w/role-specific',
            });

            expect(invitation.source).toBe('generated');
            expect(invitation.text).toContain('https://zoom.us/w/role-specific');
            expect(invitation.text).toContain('Meeting ID: 12345');
            expect(invitation.text).toContain('Passcode: abc123');
            expect(invitation.text).toContain('Dial by your location');
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });
    });
});
