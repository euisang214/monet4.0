import { auth } from '@/auth';
import { qcQueue } from '@/lib/queues';

/**
 * POST /api/shared/qc/[bookingId]/recheck
 * 
 * Trigger QC revalidation for a booking.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ bookingId: string }> }
) {
    const session = await auth();

    if (!session?.user) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { bookingId } = await params;

    // Add job to QC queue
    await qcQueue.add('process-qc', { bookingId }, {
        jobId: `recheck:${bookingId}:${Date.now()}`,
    });

    return Response.json({
        success: true,
        message: 'QC recheck queued',
        bookingId,
    });
}
