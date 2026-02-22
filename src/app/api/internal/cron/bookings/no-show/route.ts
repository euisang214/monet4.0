import { requireCronAuth } from '@/lib/core/cron-auth';
import { processNoShowCheck } from '@/lib/queues/bookings';

export async function GET(request: Request) {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) {
        return unauthorized;
    }

    try {
        const result = await processNoShowCheck();
        return Response.json({ data: result });
    } catch (error) {
        console.error('[CRON] No-show check failed:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
