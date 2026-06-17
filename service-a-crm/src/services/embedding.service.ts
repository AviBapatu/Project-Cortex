import type { IShopper } from '../models/Shopper.js';
import { pipeline } from '@xenova/transformers';

const EMBEDDING_DIMS = 384;
const EMBEDDING_MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

let _embeddingPipeline: any = null;
async function getEmbeddingPipeline() {
  if (!_embeddingPipeline) {
    _embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL_NAME);
  }
  return _embeddingPipeline;
}

export async function embedShopper(shopper: IShopper): Promise<void> {
  const summary = shopper.ai?.digitalTwinSummary;
  if (!summary) {
    throw new Error(`Shopper ${shopper.customerId} has no digitalTwinSummary to embed.`);
  }

  try {
    const pipe = await getEmbeddingPipeline();
    const output: any = await pipe(summary, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data) as number[];

    if (vector.length !== EMBEDDING_DIMS) {
      throw new Error(`Unexpected embedding dimensions: ${vector.length} (expected ${EMBEDDING_DIMS})`);
    }

    shopper.ai.embeddingVector = vector;
    shopper.ai.embeddingModel = EMBEDDING_MODEL_NAME;
    shopper.ai.lastEmbeddedAt = new Date();
    shopper.status = 'ACTIVE';
    await shopper.save();

  } catch (err: unknown) {
    const status = (err as { status?: number })?.status ?? (err as { statusCode?: number })?.statusCode;

    if (status === 429 || status === 500) {
      shopper.ai.embeddingVector = null;
      shopper.status = 'EMBEDDING_PENDING';
      await shopper.save();
      // TODO: enqueue embeddingRefreshQueue.add('retry_embed', { customerId: shopper.customerId })
      console.warn(`[embedding.service] Transient error (${status}) for ${shopper.customerId} — marked EMBEDDING_PENDING`);
    } else {
      throw err;
    }
  }
}
