import { headers } from 'next/headers';

/**
 * In-memory rate limiter for development as specified in CLAUDE.md.
 * 
 * Note: This uses a global Map which persists across hot reloads in dev
 * but would be reset on server restart. For production with multiple instances,
 * this should be backed by Redis.
 */

// Use global to persist across hot reloads in development
const globalForRateLimit = global as unknown as { rateLimit: Map<string, { count: number; resetAt: number }> };
const rateLimit = globalForRateLimit.rateLimit || new Map<string, { count: number; resetAt: number }>();

if (process.env.NODE_ENV !== 'production') {
    globalForRateLimit.rateLimit = rateLimit;
}

export async function checkRateLimit(identifier?: string, limit: number = 10, windowMs: number = 60000): Promise<boolean> {
    const now = Date.now();

    // If no identifier provided, try to identify by IP or some other header
    // In a real app, you'd want robust IP detection.
    // For this scope, we require explicit identifier (user ID or email or IP passed in)
    // But typically getting IP in App Router requires headers()
    let key = identifier;

    if (!key) {
        const headersList = await headers();
        key = headersList.get('x-forwarded-for') || 'anonymous';
    }

    const record = rateLimit.get(key);

    if (!record || record.resetAt < now) {
        rateLimit.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (record.count >= limit) {
        return false;
    }

    record.count++;
    return true;
}
