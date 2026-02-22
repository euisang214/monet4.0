
import dotenv from 'dotenv';
// Load environment variables *before* any other imports
dotenv.config();

import { redisConnection, closeQueues, bookingsQueue } from '@/lib/queues/index';
import { createQCWorker } from '@/lib/queues/qc';
import { createNotificationsWorker } from '@/lib/queues/notifications';
import { createPaymentsWorker } from '@/lib/queues/payments';
import { createBookingsWorker } from '@/lib/queues/bookings';

const shouldRegisterRepeatableJobs = process.env.ENABLE_LOCAL_REPEAT_JOBS !== 'false';

console.log('🚀 Starting Background Workers...');
console.log(`🔗 Redis URL: ${process.env.REDIS_URL || 'localhost:6379'}`);

const setupRepeatableJobs = async () => {
    console.log('🗓️  Registering repeatable jobs...');

    // Expiry Check: Hourly
    await bookingsQueue.add('expiry-check', {}, {
        repeat: { pattern: '0 * * * *' }, // Every hour
        jobId: 'repeat:expiry-check', // Singleton by ID
    });

    // No-Show Check: Every 5 minutes
    await bookingsQueue.add('no-show-check', {}, {
        repeat: { pattern: '*/5 * * * *' }, // Every 5 minutes
        jobId: 'repeat:no-show-check',
    });

    // Zoom attendance retention cleanup: Daily at 03:00
    await bookingsQueue.add('zoom-attendance-retention', {}, {
        repeat: { pattern: '0 3 * * *' },
        jobId: 'repeat:zoom-attendance-retention',
    });

    console.log('✅ Repeatable jobs registered.');
};

// Main entry point wrapped in async IIFE to avoid top-level await
(async () => {
    if (shouldRegisterRepeatableJobs) {
        await setupRepeatableJobs();
    } else {
        console.log('⏭️  Skipping repeatable bookings jobs (ENABLE_LOCAL_REPEAT_JOBS=false).');
    }

    // Initialize Workers
    const workers = [
        createQCWorker(redisConnection),
        createNotificationsWorker(redisConnection),
        createPaymentsWorker(redisConnection),
        createBookingsWorker(redisConnection),
    ];

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
        console.log(`\n🛑 Received ${signal}, closing queues and workers...`);

        try {
            // 1. Close all workers (stop accepting new jobs, finish current ones)
            await Promise.all(workers.map((w) => w.close()));
            console.log('✅ Workers closed.');

            // 2. Close queue instances (if any are held open - mainly strictly for producers but good practice)
            await closeQueues();
            console.log('✅ Queue connections closed.');

            process.exit(0);
        } catch (err) {
            console.error('❌ Error during shutdown:', err);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    console.log(`✅ ${workers.length} workers started successfully.`);
})();
