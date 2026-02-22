import { NextResponse } from 'next/server';

function readBearerToken(authorizationHeader: string | null): string | null {
    if (!authorizationHeader) {
        return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
        return null;
    }

    return token.trim() || null;
}

function hasVercelCronHeaders(request: Request): boolean {
    const xVercelCron = request.headers.get('x-vercel-cron');
    if (xVercelCron === '1') {
        return true;
    }

    const userAgent = request.headers.get('user-agent');
    return Boolean(userAgent && userAgent.toLowerCase().includes('vercel-cron'));
}

export function requireCronAuth(request: Request): Response | null {
    const configuredSecret = process.env.CRON_SECRET?.trim();

    if (configuredSecret) {
        const token = readBearerToken(request.headers.get('authorization'));
        if (token !== configuredSecret) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }
        return null;
    }

    if (process.env.NODE_ENV !== 'production' || hasVercelCronHeaders(request)) {
        return null;
    }

    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
