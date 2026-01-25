
import dotenv from 'dotenv';
// Load environment variables *before* any other imports
dotenv.config();

import { redisConnection, closeQueues, bookingsQueue } from '@/lib/queues/index';
import { createQCWorker } from '@/lib/queues/qc';
import { createNotificationsWorker } from '@/lib/queues/notifications';
import { createPaymentsWorker } from '@/lib/queues/payments';
import { createBookingsWorker } from '@/lib/queues/bookings';

console.log('🚀 Starting Background Workers...');
console.log(`🔗 Redis URL: ${process.env.REDIS_URL || 'localhost:6379'}`);

const setupRepeatableJobs = async () => {
    console.log('🗓️  Registering repeatable jobs...');

    // Expiry Check: Hourly
    await bookingsQueue.add('expiry-check', {}, {
        repeat: { pattern: '0 * * * *' }, // Every hour
        jobId: 'repeat:expiry-check', // Singleton by ID
    });

    // No-Show Check: Every 15 minutes
    await bookingsQueue.add('no-show-check', {}, {
        repeat: { pattern: '*/15 * * * *' }, // Every 15 minutes
        jobId: 'repeat:no-show-check',
    });

    console.log('✅ Repeatable jobs registered.');
};

// Main entry point wrapped in async IIFE to avoid top-level await
(async () => {
    await setupRepeatableJobs();

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
