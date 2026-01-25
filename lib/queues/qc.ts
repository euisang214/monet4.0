import { Worker, Job, ConnectionOptions } from 'bullmq';
import { QCService } from '@/lib/domain/qc/services';

// Using factory pattern to avoid side effects on import
export function createQCWorker(connection: ConnectionOptions) {
    const worker = new Worker('qc', async (job: Job) => {
        console.log(`[QC] Processing job ${job.id}:`, job.name, job.data);

        if (job.name === 'qc-timeout') {
            return await QCService.handleTimeout(job.data.bookingId);
        }

        return await QCService.processQCJob(job.data.bookingId);
    }, {
        connection,
        concurrency: 5, // Process up to 5 QC checks in parallel
    });

    worker.on('completed', (job) => {
        console.log(`[QC] Job ${job.id} completed!`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[QC] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}
