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
            });

            expect(result.join_url).toBe('https://zoom.us/j/12345');
            expect(result.id).toBe(12345);

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
});
