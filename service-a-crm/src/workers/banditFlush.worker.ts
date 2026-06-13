import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { Campaign } from '../models/Campaign.js';
import * as bandit from '../services/bandit.service.js';

interface BanditFlushJobData {
  campaignId: string;
}

async function processBanditFlush(job: Job<BanditFlushJobData>): Promise<void> {
  const { campaignId } = job.data;

  // Read all final stats from Redis
  const stats = await bandit.getAllStats(campaignId);

  // Write into Campaign.variants[].stats in MongoDB
  for (const stat of stats) {
    await Campaign.updateOne(
      { campaignId, 'variants.variantId': stat.variantId },
      {
        $set: {
          'variants.$.stats.sent': stat.sent,
          'variants.$.stats.opens': stat.opens,
          'variants.$.stats.clicks': stat.clicks,
        },
      }
    );
  }

  // Clean up Redis keys
  await bandit.clearStats(campaignId);

  console.log(`[banditFlush.worker] Flushed final stats for campaign ${campaignId}:`, stats);
}

export function startBanditFlushWorker() {
  const worker = new Worker<BanditFlushJobData>('bandit_flush_queue', processBanditFlush, {
    connection: redisConnection,
    concurrency: 5,
  });

  worker.on('completed', (job) => {
    console.log(`[banditFlush.worker] Stats flushed for campaign ${job.data.campaignId}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[banditFlush.worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[banditFlush.worker] Worker error:', err);
  });

  console.log('[banditFlush.worker] Started');
  return worker;
}
