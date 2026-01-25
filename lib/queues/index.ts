
import { Queue, ConnectionOptions } from 'bullmq';

// --- Redis Connection Configuration ---
// Adhering to CLAUDE.md: "All queues and workers share a Redis connection config"
// We export OPTIONS, not the client itself, so BullMQ can manage blocking connections correctly.
export const redisConnection: ConnectionOptions = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // BullMQ requires maxRetriesPerRequest to be null
    maxRetriesPerRequest: null,
};

// --- Queue Instances ---
// These are the "Producers" used by the API to add jobs.
export const qcQueue = new Queue('qc', { connection: redisConnection });
export const notificationsQueue = new Queue('notifications', { connection: redisConnection });
export const paymentsQueue = new Queue('payments', { connection: redisConnection });
export const bookingsQueue = new Queue('bookings', { connection: redisConnection });

// Helper to gracefully close all queues (useful for shutdown scripts)
export async function closeQueues() {
    await Promise.all([
        qcQueue.close(),
        notificationsQueue.close(),
        paymentsQueue.close(),
        bookingsQueue.close(),
    ]);
}
