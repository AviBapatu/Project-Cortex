import type { IShopper } from '../models/Shopper.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

const EMBEDDING_DIMS = 3072;
const EMBEDDING_MODEL_NAME = 'gemini-embedding-001';

export async function embedShopper(shopper: IShopper): Promise<void> {
  const summary = shopper.ai?.digitalTwinSummary;
  if (!summary) {
    throw new Error(`Shopper ${shopper.customerId} has no digitalTwinSummary to embed.`);
  }

  try {
    const embedRes = await embeddingModel.embedContent(summary);
    const vector = embedRes.embedding.values;

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
