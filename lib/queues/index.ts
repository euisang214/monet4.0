import { Queue, ConnectionOptions } from 'bullmq';

// --- Redis Connection Configuration ---
// Adhering to CLAUDE.md: "All queues and workers share a Redis connection config"
// We export OPTIONS, not the client itself, so BullMQ can manage blocking connections correctly.
export const redisConnection: ConnectionOptions = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // BullMQ requires maxRetriesPerRequest to be null
    maxRetriesPerRequest: null,
};

type QueueName = 'qc' | 'notifications' | 'payments' | 'bookings';

const queueCache = new Map<QueueName, Queue>();

function getOrCreateQueue(name: QueueName) {
    const existingQueue = queueCache.get(name);
    if (existingQueue) {
        return existingQueue;
    }

    const queue = new Queue(name, { connection: redisConnection });
    queueCache.set(name, queue);
    return queue;
}

function createLazyQueue(name: QueueName) {
    return new Proxy({} as Queue, {
        get(_target, property, receiver) {
            const queue = getOrCreateQueue(name);
            const value = Reflect.get(queue, property, receiver);

            if (typeof value === 'function') {
                return value.bind(queue);
            }

            return value;
        },
    });
}

// --- Queue Instances ---
// These producers stay lazy so module imports during Next.js builds do not try
// to connect to Redis before a job is actually enqueued.
export const qcQueue = createLazyQueue('qc');
export const notificationsQueue = createLazyQueue('notifications');
export const paymentsQueue = createLazyQueue('payments');
export const bookingsQueue = createLazyQueue('bookings');

// Helper to gracefully close all queues (useful for shutdown scripts)
export async function closeQueues() {
    const queues = Array.from(queueCache.values());
    queueCache.clear();
    await Promise.all(queues.map((queue) => queue.close()));
}
