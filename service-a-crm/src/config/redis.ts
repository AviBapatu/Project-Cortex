import { Redis } from 'ioredis';
import { config } from './env.js';

/**
 * Connection options shared by ioredis client and BullMQ queues/workers.
 * BullMQ requires maxRetriesPerRequest: null.
 */
export const redisConnection = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  maxRetriesPerRequest: null as null,
};

/** Shared ioredis client — used for direct Redis operations (locks, bandit counters, etc.) */
const redis = new Redis(redisConnection);

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redis;

