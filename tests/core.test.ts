import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the auth module before importing
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

// Mock next/headers for rate limiting
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve({
        get: vi.fn(() => '127.0.0.1'),
    })),
}));

import { auth } from '@/auth';
import { withRole } from '@/lib/core/api-helpers';
import { checkRateLimit } from '@/lib/core/rate-limit';
import { Role } from '@prisma/client';

describe('Core Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('withRole', () => {
        it('should return 403 for unauthenticated request', async () => {
            vi.mocked(auth).mockResolvedValue(null);

            const handler = vi.fn();
            const wrappedHandler = withRole(Role.ADMIN, handler);

            const mockRequest = new Request('http://localhost/api/test');
            const response = await wrappedHandler(mockRequest);

            expect(response.status).toBe(403);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should return 403 for wrong role', async () => {
            vi.mocked(auth).mockResolvedValue({
                user: { id: 'user1', email: 'test@test.com', role: Role.CANDIDATE },
                expires: '2026-01-01',
            });

            const handler = vi.fn();
            const wrappedHandler = withRole(Role.ADMIN, handler);

            const mockRequest = new Request('http://localhost/api/test');
            const response = await wrappedHandler(mockRequest);

            expect(response.status).toBe(403);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should call handler for correct role', async () => {
            vi.mocked(auth).mockResolvedValue({
                user: { id: 'admin1', email: 'admin@test.com', role: Role.ADMIN },
                expires: '2026-01-01',
            });

            const mockResponse = new Response(JSON.stringify({ success: true }));
            const handler = vi.fn().mockResolvedValue(mockResponse);
            const wrappedHandler = withRole(Role.ADMIN, handler);

            const mockRequest = new Request('http://localhost/api/test');
            const response = await wrappedHandler(mockRequest);

            expect(handler).toHaveBeenCalledWith(mockRequest);
            expect(response).toBe(mockResponse);
        });
    });

    describe('checkRateLimit', () => {
        beforeEach(() => {
            // Clear the rate limit map before each test
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return true when under limit', async () => {
            const result = await checkRateLimit('test-user-1', 10, 60000);
            expect(result).toBe(true);
        });

        it('should return false when limit exceeded', async () => {
            const identifier = 'test-user-exceeded';

            // Make requests up to the limit
            for (let i = 0; i < 10; i++) {
                await checkRateLimit(identifier, 10, 60000);
            }

            // Next request should be rate limited
            const result = await checkRateLimit(identifier, 10, 60000);
            expect(result).toBe(false);
        });

        it('should reset after window expires', async () => {
            const identifier = 'test-user-reset';

            // Exhaust the limit
            for (let i = 0; i < 10; i++) {
                await checkRateLimit(identifier, 10, 60000);
            }

            // Verify limit is hit
            expect(await checkRateLimit(identifier, 10, 60000)).toBe(false);

            // Advance time past window
            vi.advanceTimersByTime(60001);

            // Should be allowed again
            const result = await checkRateLimit(identifier, 10, 60000);
            expect(result).toBe(true);
        });

        it('should handle custom identifier', async () => {
            const result1 = await checkRateLimit('custom-id-1', 2, 60000);
            const result2 = await checkRateLimit('custom-id-1', 2, 60000);
            const result3 = await checkRateLimit('custom-id-1', 2, 60000);

            expect(result1).toBe(true);
            expect(result2).toBe(true);
            expect(result3).toBe(false); // Third request exceeds limit of 2
        });
    });
});
