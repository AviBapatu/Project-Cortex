import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { Campaign } from '../models/Campaign.js';
import { dispatchQueue } from '../queues/queues.js';
import * as bandit from '../services/bandit.service.js';
import { Shopper } from '../models/Shopper.js';

const WEBHOOK_CONCURRENCY = parseInt(process.env.WEBHOOK_CONCURRENCY || '100', 10);
const OPTIMIZATION_THRESHOLD = parseFloat(process.env.OPTIMIZATION_THRESHOLD || '0.15');

interface WebhookJobData {
  messageId: string;
  campaignId: string;
  variantId: 'A' | 'B' | 'C';
  customerId: string;
  eventType: 'delivered' | 'opened' | 'clicked' | 'failed';
  provider: string;
}

/**
 * Enqueues the remaining 85% of a campaign audience (winner variant only).
 * Called once when the 15% optimization trigger fires.
 */
async function enqueueRemaining85Percent(
  campaignId: string,
  winnerVariantId: 'A' | 'B' | 'C',
  alreadyProcessedCount: number
): Promise<void> {
  const campaign = await Campaign.findOne({ campaignId });
  if (!campaign) return;

  // Get full audience by re-querying the segment
  const { hybridSearch, deterministicSearch } = await import('../services/rag.service.js');
  
  let allShoppers = [];
  const sq = campaign.segmentQuery || {};
  
  if (sq.isSemantic !== undefined) {
    if (sq.isSemantic) {
      const result = await hybridSearch(sq.filters || {}, sq.semanticQuery);
      allShoppers = result.shoppers;
    } else {
      const result = await deterministicSearch(sq.filters || {});
      allShoppers = result.shoppers;
    }
  } else {
    // Old format fallback
    const { Shopper: ShopperModel } = await import('../models/Shopper.js');
    allShoppers = await ShopperModel.find({
      ...campaign.segmentQuery,
      status: 'ACTIVE',
    }).select('customerId').limit(campaign.audienceSize);
  }

  // Skip the first batch already dispatched
  const remainingShoppers = allShoppers.slice(alreadyProcessedCount);

  const jobs = remainingShoppers.map(shopper => ({
    name: 'dispatch',
    data: {
      campaignId,
      customerId: shopper.customerId,
      variantId: winnerVariantId,
    },
  }));

  if (jobs.length > 0) {
    await dispatchQueue.addBulk(jobs);
    console.log(`[webhook.worker] Enqueued ${jobs.length} remaining jobs with winner variant ${winnerVariantId}`);
  }
}

async function processWebhook(job: Job<WebhookJobData>): Promise<void> {
  const { campaignId, variantId, eventType, customerId } = job.data;

  // Handle engagement events
  if (eventType === 'opened') {
    await bandit.recordEvent(campaignId, variantId, 'opens');
  } else if (eventType === 'clicked') {
    await bandit.recordEvent(campaignId, variantId, 'clicks');
  } else if (eventType === 'failed') {
    await Campaign.updateOne({ campaignId }, { $inc: { failed: 1 } });
  }

  // Check 15% optimization threshold
  const camp = await Campaign.findOne({ campaignId });
  if (!camp || camp.status !== 'EXECUTING') return;

  const deliveredPct = camp.processed / camp.audienceSize;
  if (deliveredPct >= OPTIMIZATION_THRESHOLD) {
    // ── Tier-1 Fix 12.2: Atomic MongoDB CAS — only one worker wins this race ──
    const lockedCamp = await Campaign.findOneAndUpdate(
      { campaignId, status: 'EXECUTING' },
      { $set: { status: 'OPTIMIZING' } },
      { new: true }
    );

    if (lockedCamp) {
      // This worker won the race — pick winner and dispatch remaining
      const winner = await bandit.pickWinner(campaignId);
      await Campaign.updateOne({ campaignId }, { winnerVariant: winner });
      await enqueueRemaining85Percent(campaignId, winner, camp.processed);
      console.log(`[webhook.worker] Campaign ${campaignId} → OPTIMIZING. Winner: ${winner}`);
    }
    // If lockedCamp is null, another worker already transitioned — do nothing
  }
}

export function startWebhookWorker() {
  const worker = new Worker<WebhookJobData>('webhook_queue', processWebhook, {
    connection: redisConnection,
    concurrency: WEBHOOK_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    // Intentionally low verbosity — this worker processes very high volume
  });

  worker.on('failed', (job, err) => {
    console.error(`[webhook.worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[webhook.worker] Worker error:', err);
  });

  console.log(`[webhook.worker] Started with concurrency=${WEBHOOK_CONCURRENCY}`);
  return worker;
}
