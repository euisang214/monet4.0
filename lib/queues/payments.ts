import { Worker, Job, ConnectionOptions } from 'bullmq';
import { PaymentsService } from '@/lib/domain/payments/services';

export function createPaymentsWorker(connection: ConnectionOptions) {
    const worker = new Worker('payments', async (job: Job) => {
        console.log(`[PAYMENTS] Processing job ${job.id}:`, job.name);

        return await PaymentsService.processPayoutJob(job.data.bookingId);
    }, {
        connection,
        concurrency: 2, // Low concurrency to be safe with financial rate limits/race conditions
    });

    worker.on('completed', (job) => {
        console.log(`[PAYMENTS] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[PAYMENTS] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}
