import { Worker, Job } from 'bullmq';
import axios from 'axios';
import { redisConnection } from '../config/redis.js';
import { Shopper } from '../models/Shopper.js';
import { Campaign } from '../models/Campaign.js';
import { banditFlushQueue } from '../queues/queues.js';
import * as bandit from '../services/bandit.service.js';

const SERVICE_B_URL = process.env.SERVICE_B_URL || 'http://localhost:5000';
const DISPATCH_CONCURRENCY = parseInt(process.env.DISPATCH_CONCURRENCY || '50', 10);
const FAILURE_THRESHOLD = parseFloat(process.env.FAILURE_THRESHOLD || '0.2');
const MIN_SAMPLE_RATIO = 0.05; // Fix 12.8: gate failure check behind minimum 5% sample

interface DispatchJobData {
  campaignId: string;
  customerId: string;
  variantId: 'A' | 'B' | 'C';
}

async function processDispatch(job: Job<DispatchJobData>): Promise<void> {
  const { campaignId, customerId, variantId } = job.data;

  // Fetch shopper and campaign in parallel
  const [shopper, campaign] = await Promise.all([
    Shopper.findOne({ customerId }),
    Campaign.findOne({ campaignId }),
  ]);

  if (!shopper || !campaign) {
    throw new Error(`Shopper (${customerId}) or Campaign (${campaignId}) not found.`);
  }

  const variant = campaign.variants.find(v => v.variantId === variantId);
  if (!variant) {
    throw new Error(`Variant ${variantId} not found in campaign ${campaignId}`);
  }

  // ── Tier-1 Fix 12.10: Safe firstName fallback ──
  const safeName = shopper.firstName?.trim() || 'Valued Customer';
  const personalizedMessage = variant.template.replace(/\{\{firstName\}\}/g, safeName);

  // Dispatch to Service B
  await axios.post(`${SERVICE_B_URL}/send`, {
    to: shopper.phone,
    body: personalizedMessage,
    messageId: job.id,
    campaignId,
    variantId,
    customerId,
  }, { timeout: 10000 });

  // Record the send in Redis bandit counters
  await bandit.recordSent(campaignId, variantId);

  // Atomically increment processed count and get updated campaign state
  const updatedCampaign = await Campaign.findOneAndUpdate(
    { campaignId },
    { $inc: { processed: 1 } },
    { new: true }
  );

  if (!updatedCampaign) return;

  // ── Fix 12.8: Gate FAILED check behind minimum sample size ──
  const minSampleSize = Math.ceil(updatedCampaign.audienceSize * MIN_SAMPLE_RATIO);
  if (
    updatedCampaign.processed >= minSampleSize &&
    updatedCampaign.failed / updatedCampaign.audienceSize > FAILURE_THRESHOLD &&
    updatedCampaign.status === 'EXECUTING'
  ) {
    await Campaign.updateOne({ campaignId }, { status: 'FAILED' });
    console.warn(`[dispatch.worker] Campaign ${campaignId} → FAILED (failure rate exceeded threshold)`);
  }

  // Check for completion
  if (updatedCampaign.processed >= updatedCampaign.audienceSize) {
    const alreadyCompleted = await Campaign.findOneAndUpdate(
      { campaignId, status: { $in: ['EXECUTING', 'OPTIMIZING'] } },
      { status: 'COMPLETED' },
      { new: false }
    );
    if (alreadyCompleted) {
      await banditFlushQueue.add('flush_stats', { campaignId });
      console.log(`[dispatch.worker] Campaign ${campaignId} → COMPLETED`);
    }
  }
}

export function startDispatchWorker() {
  const worker = new Worker<DispatchJobData>('dispatch_queue', processDispatch, {
    connection: redisConnection,
    concurrency: DISPATCH_CONCURRENCY,
  });

  worker.on('completed', (job) => {
    console.log(`[dispatch.worker] Job ${job.id} completed for ${job.data.customerId}`);
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[dispatch.worker] Job ${job.id} failed:`, err.message);
    // Increment failed count for campaign failure threshold check
    await Campaign.updateOne({ campaignId: job.data.campaignId }, { $inc: { failed: 1 } });
  });

  worker.on('error', (err) => {
    console.error('[dispatch.worker] Worker error:', err);
  });

  console.log(`[dispatch.worker] Started with concurrency=${DISPATCH_CONCURRENCY}`);
  return worker;
}
