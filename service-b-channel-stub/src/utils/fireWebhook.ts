import axios from 'axios';

const SERVICE_A_WEBHOOK_URL = process.env.SERVICE_A_WEBHOOK_URL || 'http://localhost:4000/webhooks/stub';
const SIMULATED_FAILURE_RATE = parseFloat(process.env.SIMULATED_FAILURE_RATE || '0.05');

type EventType = 'delivered' | 'opened' | 'clicked' | 'failed';

/**
 * Fires a webhook callback to Service A after a simulated processing delay.
 * Randomizes event types to simulate realistic engagement:
 *   5% failures, 40% opened, 25% clicked (implies opened), 30% delivered-only.
 */
export async function fireWebhook(payload: {
  messageId: string;
  campaignId: string;
  variantId: string;
  customerId: string;
  delayMs: number;
}): Promise<void> {
  const { messageId, campaignId, variantId, customerId, delayMs } = payload;

  // Wait for simulated delivery time
  await new Promise(res => setTimeout(res, delayMs));

  // Determine event type
  let eventType: EventType;
  const rand = Math.random();
  if (rand < SIMULATED_FAILURE_RATE) {
    eventType = 'failed';
  } else if (rand < 0.35) {
    eventType = 'clicked'; // clicked implies opened
  } else if (rand < 0.75) {
    eventType = 'opened';
  } else {
    eventType = 'delivered';
  }

  try {
    await axios.post(SERVICE_A_WEBHOOK_URL, {
      messageId,
      campaignId,
      variantId,
      customerId,
      eventType,
      timestamp: new Date().toISOString(),
    }, { timeout: 5000 });
  } catch (err: any) {
    // Log but don't throw — webhook delivery failure is not a Service B crash
    console.error(`[fireWebhook] Failed to deliver ${eventType} webhook for ${messageId}:`, err.message);
  }
}
