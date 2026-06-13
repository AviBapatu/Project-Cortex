/**
 * workers.entry.ts — Separate process entrypoint for all BullMQ workers.
 *
 * ⚠️  This must run as a SEPARATE process from server.ts.
 *    Run: npm run start:workers
 *
 * Why separate? If Service B crashes and webhook.worker throws unhandled errors,
 * it should NOT take down the Express API. Fault isolation is the whole point.
 */

import 'dotenv/config';
import { connectDB } from './src/config/db.js';
import redis from './src/config/redis.js';
import { startDispatchWorker } from './src/workers/dispatch.worker.js';
import { startWebhookWorker } from './src/workers/webhook.worker.js';
import { startEmbeddingRefreshWorker } from './src/workers/embeddingRefresh.worker.js';
import { startBanditFlushWorker } from './src/workers/banditFlush.worker.js';
import { startOpportunityCron } from './src/cron/opportunityEngine.cron.js';

async function bootstrap() {
  try {
    await connectDB();
    await redis.ping();
    console.log('[workers.entry] DB + Redis connected.');

    // Start all workers
    const dispatchWorker = startDispatchWorker();
    const webhookWorker = startWebhookWorker();
    const embeddingRefreshWorker = startEmbeddingRefreshWorker();
    const banditFlushWorker = startBanditFlushWorker();

    // Start opportunity engine cron (single owner — not in server.ts)
    startOpportunityCron();

    console.log('[workers.entry] All workers running. Waiting for jobs...');

    // Graceful shutdown
    const shutdown = async () => {
      console.log('[workers.entry] Shutting down gracefully...');
      await Promise.all([
        dispatchWorker.close(),
        webhookWorker.close(),
        embeddingRefreshWorker.close(),
        banditFlushWorker.close(),
      ]);
      await redis.quit();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Global error handler — log but don't crash the whole process
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[workers.entry] Unhandled rejection:', reason);
    });

  } catch (error) {
    console.error('[workers.entry] Failed to bootstrap workers:', error);
    process.exit(1);
  }
}

bootstrap();
