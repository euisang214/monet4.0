import { requireCronAuth } from '@/lib/core/cron-auth';
import { processExpiryCheck } from '@/lib/queues/bookings';

export async function GET(request: Request) {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) {
        return unauthorized;
    }

    try {
        const result = await processExpiryCheck();
        return Response.json({ data: result });
    } catch (error) {
        console.error('[CRON] Expiry check failed:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
