import { ConnectionOptions, Job, Worker } from 'bullmq';
import {
    processConfirmBooking,
    processExpiryCheck,
    processNoShowCheck,
    processRescheduleBooking,
    processZoomAttendanceEvent,
    processZoomAttendanceRetention,
} from '@/lib/queues/bookings/processors';

export const BOOKING_QUEUE_NAME = 'bookings';

export function createBookingsWorker(connection: ConnectionOptions) {
    const worker = new Worker(BOOKING_QUEUE_NAME, async (job: Job) => {
        console.log(`[BOOKINGS] Processing job ${job.id}:`, job.name);

        try {
            if (job.name === 'confirm-booking') {
                return await processConfirmBooking(job.data.bookingId);
            }
            if (job.name === 'reschedule-booking') {
                return await processRescheduleBooking(job.data.bookingId, job.data.oldZoomMeetingId);
            }
            if (job.name === 'expiry-check') {
                return await processExpiryCheck();
            }
            if (job.name === 'no-show-check') {
                return await processNoShowCheck();
            }
            if (job.name === 'zoom-attendance-event') {
                return await processZoomAttendanceEvent(job.data.zoomAttendanceEventId);
            }
            if (job.name === 'zoom-attendance-retention') {
                return await processZoomAttendanceRetention();
            }
        } catch (error: any) {
            console.error(`[BOOKINGS] Job ${job.id} failed:`, error);
            throw error;
        }

        return { processed: true };
    }, {
        connection,
        concurrency: 5,
    });

    worker.on('completed', (job) => {
        console.log(`[BOOKINGS] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[BOOKINGS] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}
