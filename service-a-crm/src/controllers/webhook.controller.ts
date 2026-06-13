import { type Request, type Response } from 'express';
import redis from '../config/redis.js';
import { webhookQueue } from '../queues/queues.js';

export interface WebhookPayload {
  messageId: string;
  campaignId: string;
  variantId: 'A' | 'B' | 'C';
  customerId: string;
  eventType: 'delivered' | 'opened' | 'clicked' | 'failed';
  provider: string;
  timestamp?: string;
}

/**
 * POST /webhooks/:provider
 *
 * Idempotency check (Fix 12.3): Uses Redis SET NX EX 86400 to ensure each
 * unique (provider, campaignId, messageId) is processed at most once.
 * The idempotency key is namespaced by provider to handle provider ID recycling.
 *
 * Always returns 200/202 quickly — actual processing is async via webhookQueue.
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { provider } = req.params;
    const payload: WebhookPayload = {
      ...req.body,
      provider,
      timestamp: req.body.timestamp || new Date().toISOString(),
    };

    const { messageId, campaignId } = payload;

    if (!messageId || !campaignId) {
      res.status(400).json({ error: 'messageId and campaignId are required.' });
      return;
    }

    // ── Tier-1 Fix 12.3: Namespaced idempotency lock, TTL = 24h ──
    const idempotencyKey = `webhook:${provider}:${campaignId}:${messageId}`;
    const isNew = await redis.set(idempotencyKey, '1', 'EX', 86400, 'NX');

    if (!isNew) {
      // Duplicate webhook — silently drop and ack
      res.sendStatus(200);
      return;
    }

    // Enqueue for async processing
    await webhookQueue.add('process_webhook', payload, {
      jobId: `${provider}-${campaignId}-${messageId}`, // BullMQ doesn't allow colons in jobId
    });

    res.sendStatus(202);
  } catch (error: any) {
    console.error('[webhook.controller] handleWebhook error:', error);
    // Always return 200-range to prevent Service B from retrying indefinitely
    res.sendStatus(200);
  }
}
