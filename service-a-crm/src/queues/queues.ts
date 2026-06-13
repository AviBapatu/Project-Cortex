import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

/**
 * Central BullMQ Queue Registry.
 * All 4 queues are created here as singletons.
 * Concurrency is set on the Worker side, not here.
 *
 * Import individual queues from here wherever you need a producer.
 */

export const dispatchQueue = new Queue('dispatch_queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const webhookQueue = new Queue('webhook_queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 5000 },
  },
});

export const embeddingRefreshQueue = new Queue('embeddingRefreshQueue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

export const banditFlushQueue = new Queue('bandit_flush_queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 3000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});
