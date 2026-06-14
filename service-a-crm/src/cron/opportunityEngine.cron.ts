import cron from 'node-cron';
import redis from '../config/redis.js';
import { runOpportunityEngine } from './opportunityEngine.logic.js';

const CRON_LOCK_KEY = 'lock:opportunity_cron';
const CRON_LOCK_TTL = 3600; // 1 hour — prevents duplicate runs across replicas

/**
 * Starts the opportunity engine cron.
 * Schedules at the top of every hour.
 *
 * ── Tier-1 Fix 12.12: Distributed Redis lock ──
 * If multiple replicas run this, only one will acquire the lock and execute.
 * The lock TTL (1h) exceeds the expected runtime of the engine.
 */
export function startOpportunityCron(): void {
  cron.schedule('0 * * * *', async () => {

    // Attempt to acquire the distributed lock
    const lock = await redis.set(CRON_LOCK_KEY, '1', 'EX', CRON_LOCK_TTL, 'NX');

    if (!lock) {
      console.log('[opportunityCron] Skipped — lock held by another instance.');
      return;
    }

    try {
      await runOpportunityEngine();
    } catch (err) {
      console.error('[opportunityCron] Engine failed:', err);
    }
    // Lock expires automatically via Redis TTL — no need to explicitly delete
  });

  console.log('[opportunityCron] Scheduled hourly (distributed lock enabled).');
}

/**
 * Manually triggers the opportunity engine — useful for testing without waiting for cron.
 * Bypasses the distributed lock for direct invocation.
 */
export async function triggerOpportunityEngine(): Promise<void> {
  await runOpportunityEngine();
}
