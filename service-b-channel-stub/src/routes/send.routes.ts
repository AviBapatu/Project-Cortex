import { Router, Request, Response } from 'express';
import { fireWebhook } from '../utils/fireWebhook.js';

const router = Router();

const SIMULATED_DELAY_MS = parseInt(process.env.SIMULATED_DELAY_MS || '1500', 10);

/**
 * POST /send
 * Accepts a message dispatch from Service A, simulates delivery,
 * then fires a webhook callback back to Service A.
 *
 * Body: { to, body, messageId, campaignId, variantId, customerId }
 */
router.post('/', (req: Request, res: Response) => {
  const { to, body, messageId, campaignId, variantId, customerId } = req.body;

  if (!messageId || !campaignId || !variantId) {
    res.status(400).json({ error: 'messageId, campaignId, and variantId are required.' });
    return;
  }

  // Acknowledge immediately — fire-and-forget the webhook callback
  res.status(202).json({
    accepted: true,
    messageId,
    estimatedDeliveryMs: SIMULATED_DELAY_MS,
  });

  // Fire webhook asynchronously (non-blocking)
  fireWebhook({
    messageId,
    campaignId,
    variantId,
    customerId,
    delayMs: SIMULATED_DELAY_MS + Math.floor(Math.random() * 500), // ±500ms jitter
  }).catch(err => {
    console.error(`[send.routes] fireWebhook error for ${messageId}:`, err);
  });
});

export default router;
