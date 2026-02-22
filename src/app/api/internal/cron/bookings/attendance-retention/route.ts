import { requireCronAuth } from '@/lib/core/cron-auth';
import { processZoomAttendanceRetention } from '@/lib/queues/bookings';

export async function GET(request: Request) {
    const unauthorized = requireCronAuth(request);
    if (unauthorized) {
        return unauthorized;
    }

    try {
        const result = await processZoomAttendanceRetention();
        return Response.json({ data: result });
    } catch (error) {
        console.error('[CRON] Attendance retention failed:', error);
        return Response.json({ error: 'internal_error' }, { status: 500 });
    }
}
