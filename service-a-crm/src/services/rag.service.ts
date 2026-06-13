import { GoogleGenerativeAI } from '@google/generative-ai';
import mongoose from 'mongoose';
import { Shopper, type IShopper } from '../models/Shopper.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
const geminiFlash = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

export interface RfmFilters {
  minLtv?: number;
  maxLtv?: number;
  minDaysSinceLastPurchase?: number;
  maxDaysSinceLastPurchase?: number;
  minRecencyScore?: number;
  maxRecencyScore?: number;
}

export interface CampaignVariant {
  variantId: 'A' | 'B' | 'C';
  template: string;
}

export interface HybridSearchResult {
  shoppers: IShopper[];
  audienceSize: number;
  segmentQuery: Record<string, any>;
}

// ── §7: Hybrid Search ─────────────────────────────────────────────────────────
/**
 * Two-stage search:
 * 1. Deterministic pre-filter using RFM indexes (pure Mongo)
 * 2. Vector similarity search restricted to pre-filtered IDs
 *
 * If Atlas Vector Search is not yet configured, falls back to
 * the RFM pre-filter alone (graceful degradation).
 */
export async function hybridSearch(
  rfmFilters: RfmFilters,
  queryText: string,
  vectorLimit: number = 100
): Promise<HybridSearchResult> {
  // Build deterministic Mongo filter
  const segmentQuery: Record<string, any> = {};
  if (rfmFilters.minLtv !== undefined || rfmFilters.maxLtv !== undefined) {
    segmentQuery['rfm.totalLifetimeValue'] = {};
    if (rfmFilters.minLtv !== undefined) segmentQuery['rfm.totalLifetimeValue'].$gte = rfmFilters.minLtv;
    if (rfmFilters.maxLtv !== undefined) segmentQuery['rfm.totalLifetimeValue'].$lte = rfmFilters.maxLtv;
  }
  if (rfmFilters.minDaysSinceLastPurchase !== undefined || rfmFilters.maxDaysSinceLastPurchase !== undefined) {
    segmentQuery['rfm.daysSinceLastPurchase'] = {};
    if (rfmFilters.minDaysSinceLastPurchase !== undefined) segmentQuery['rfm.daysSinceLastPurchase'].$gte = rfmFilters.minDaysSinceLastPurchase;
    if (rfmFilters.maxDaysSinceLastPurchase !== undefined) segmentQuery['rfm.daysSinceLastPurchase'].$lte = rfmFilters.maxDaysSinceLastPurchase;
  }
  if (rfmFilters.minRecencyScore !== undefined) {
    segmentQuery['rfm.recencyScore'] = { $gte: rfmFilters.minRecencyScore };
  }
  // Only search shoppers who have been embedded
  segmentQuery.status = 'ACTIVE';
  segmentQuery['ai.embeddingVector'] = { $ne: null };

  try {
    // Attempt Atlas $vectorSearch with compound pre-filter
    const queryEmbedding = await embeddingModel.embedContent(queryText);
    const queryVector = queryEmbedding.embedding.values;

    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'cortex_vector_index',
          path: 'ai.embeddingVector',
          queryVector,
          numCandidates: vectorLimit * 10,
          limit: vectorLimit,
          filter: segmentQuery,
        }
      },
      { $addFields: { searchScore: { $meta: 'vectorSearchScore' } } }
    ];

    const results = await Shopper.aggregate(pipeline);
    return {
      shoppers: results as IShopper[],
      audienceSize: results.length,
      segmentQuery,
    };
  } catch (err: any) {
    // Graceful degradation: if Atlas Vector Search index doesn't exist yet,
    // fall back to deterministic RFM pre-filter only
    if (err?.codeName === 'IndexNotFound' || err?.message?.includes('index')) {
      console.warn('[rag.service] Vector index not found — falling back to RFM filter only');
      const shoppers = await Shopper.find(segmentQuery).limit(vectorLimit);
      return { shoppers, audienceSize: shoppers.length, segmentQuery };
    }
    throw err;
  }
}

// ── §7 + Tier-1 Fix 12.5: LLM Variant Generation with Validation ─────────────
/**
 * Calls Gemini ONCE to generate exactly 3 A/B/C campaign message variants.
 * Includes strict JSON schema validation + hardcoded fallback (Fix 12.5)
 * so campaign creation NEVER crashes even if the LLM returns garbage.
 */
export async function generateCampaignVariants(
  segmentDescription: string,
  goal: string
): Promise<CampaignVariant[]> {
  const prompt = `You are a CRM campaign copywriter. Generate exactly 3 SMS/email campaign message variants for a marketing campaign.

Target Segment: ${segmentDescription}
Campaign Goal: ${goal}

Rules:
- Generate EXACTLY 3 variants labeled A, B, C.
- Each template MUST contain the placeholder {{firstName}}.
- Keep each message under 160 characters.
- Vary tone: A=formal, B=friendly, C=urgency-driven.
- Output ONLY valid JSON with NO markdown fences. Format:
[
  {"variantId": "A", "template": "...{{firstName}}..."},
  {"variantId": "B", "template": "...{{firstName}}..."},
  {"variantId": "C", "template": "...{{firstName}}..."}
]`;

  let rawText = '';
  try {
    const res = await geminiFlash.generateContent(prompt);
    rawText = res.response.text().trim();

    // Strip markdown fences if present (```json ... ```)
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (jsonMatch && jsonMatch[1]) ? jsonMatch[1].trim() : rawText;

    const parsed = JSON.parse(jsonStr);
    return validateAndReturnVariants(parsed, segmentDescription);
  } catch (err) {
    console.error('[rag.service] LLM variant generation failed — using hardcoded fallback', err);
    return getHardcodedFallbackVariants(segmentDescription);
  }
}

/**
 * ── Tier-1 Fix 12.5: Schema validation on LLM output ──
 * Validates that the parsed output is an array of exactly 3 valid variants.
 * Falls back to hardcoded templates if validation fails.
 */
function validateAndReturnVariants(
  parsed: unknown,
  segmentDescription: string
): CampaignVariant[] {
  const VALID_IDS = new Set(['A', 'B', 'C']);

  const isValid =
    Array.isArray(parsed) &&
    parsed.length === 3 &&
    parsed.every(
      (v: any) =>
        v &&
        typeof v.variantId === 'string' &&
        VALID_IDS.has(v.variantId) &&
        typeof v.template === 'string' &&
        v.template.includes('{{firstName}}')
    );

  if (!isValid) {
    console.warn('[rag.service] LLM output failed schema validation — using fallback variants');
    return getHardcodedFallbackVariants(segmentDescription);
  }

  return parsed as CampaignVariant[];
}

/**
 * Hardcoded fallback variants that always pass validation.
 * Guarantees campaign creation never fails due to LLM output issues.
 */
export function getHardcodedFallbackVariants(segmentDescription: string): CampaignVariant[] {
  return [
    {
      variantId: 'A',
      template: `Dear {{firstName}}, we have a special update tailored just for your account. Check it out today.`,
    },
    {
      variantId: 'B',
      template: `Hey {{firstName}}! Based on your history with us, we think you'll love what we have in store for you.`,
    },
    {
      variantId: 'C',
      template: `{{firstName}}, don't miss out — this exclusive offer expires soon. Act now to claim yours.`,
    },
  ];
}
