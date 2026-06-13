import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { Shopper } from '../models/Shopper.js';
import { embedShopper } from '../services/embedding.service.js';

const EMBEDDING_REFRESH_CONCURRENCY = parseInt(process.env.EMBEDDING_REFRESH_CONCURRENCY || '3', 10);

interface EmbeddingRefreshJobData {
  customerId: string;
}

async function processEmbeddingRefresh(job: Job<EmbeddingRefreshJobData>): Promise<void> {
  const { customerId } = job.data;

  const shopper = await Shopper.findOne({ customerId, status: 'EMBEDDING_PENDING' });
  if (!shopper) {
    console.log(`[embeddingRefresh.worker] Shopper ${customerId} not found or no longer EMBEDDING_PENDING. Skipping.`);
    return;
  }

  await embedShopper(shopper);
  console.log(`[embeddingRefresh.worker] Successfully re-embedded ${customerId}`);
}

export function startEmbeddingRefreshWorker() {
  const worker = new Worker<EmbeddingRefreshJobData>(
    'embeddingRefreshQueue',
    processEmbeddingRefresh,
    {
      connection: redisConnection,
      concurrency: EMBEDDING_REFRESH_CONCURRENCY,
      limiter: {
        max: 10,       // max 10 jobs per...
        duration: 60000, // ...60 seconds (respect Google free-tier RPM limits)
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[embeddingRefresh.worker] Re-embedded ${job.data.customerId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[embeddingRefresh.worker] Job ${job?.id} failed for ${job?.data?.customerId}:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[embeddingRefresh.worker] Worker error:', err);
  });

  console.log(`[embeddingRefresh.worker] Started with concurrency=${EMBEDDING_REFRESH_CONCURRENCY}, RPM-limited`);
  return worker;
}
