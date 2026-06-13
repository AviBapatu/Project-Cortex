import redis from '../config/redis.js';

type VariantId = 'A' | 'B' | 'C';
const VARIANTS: VariantId[] = ['A', 'B', 'C'];

function banditKey(campaignId: string, variantId: VariantId): string {
  return `bandit:${campaignId}:${variantId}`;
}

export async function recordSent(campaignId: string, variantId: VariantId): Promise<void> {
  await redis.hincrby(banditKey(campaignId, variantId), 'sent', 1);
}

export async function recordEvent(
  campaignId: string,
  variantId: VariantId,
  eventType: 'opens' | 'clicks'
): Promise<void> {
  await redis.hincrby(banditKey(campaignId, variantId), eventType, 1);
}

export async function pickWinner(campaignId: string): Promise<VariantId> {
  const statsArr = await Promise.all(
    VARIANTS.map(v => redis.hgetall(banditKey(campaignId, v)))
  );

  const stats = statsArr.map((s, i) => ({
    variantId: VARIANTS[i] as VariantId,
    sent: Number(s?.['sent'] ?? 0),
    opens: Number(s?.['opens'] ?? 0),
    clicks: Number(s?.['clicks'] ?? 0),
  }));

  // Fix 12.9: use rates not raw counts to handle unequal sample sizes
  const ctrs = stats.map(s => (s.sent > 0 ? s.clicks / s.sent : 0));
  const maxCtr = Math.max(...ctrs);

  if (maxCtr > 0) {
    const idx = ctrs.indexOf(maxCtr);
    return VARIANTS[idx] as VariantId;
  }

  // Fallback: open rate
  const openRates = stats.map(s => (s.sent > 0 ? s.opens / s.sent : 0));
  const maxOpenRate = Math.max(...openRates);

  if (maxOpenRate > 0) {
    const idx = openRates.indexOf(maxOpenRate);
    return VARIANTS[idx] as VariantId;
  }

  return 'C';
}

export async function getAllStats(campaignId: string): Promise<
  Array<{ variantId: VariantId; sent: number; opens: number; clicks: number }>
> {
  const statsArr = await Promise.all(
    VARIANTS.map(v => redis.hgetall(banditKey(campaignId, v)))
  );

  return statsArr.map((s, i) => ({
    variantId: VARIANTS[i] as VariantId,
    sent: Number(s?.['sent'] ?? 0),
    opens: Number(s?.['opens'] ?? 0),
    clicks: Number(s?.['clicks'] ?? 0),
  }));
}

export async function clearStats(campaignId: string): Promise<void> {
  await Promise.all(VARIANTS.map(v => redis.del(banditKey(campaignId, v))));
}
