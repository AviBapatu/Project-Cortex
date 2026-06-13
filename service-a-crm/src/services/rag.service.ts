import Groq from 'groq-sdk';
import { pipeline } from '@xenova/transformers';
import { Shopper, type IShopper } from '../models/Shopper.js';

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

// Singleton local embedding pipeline — matches the ingestData.ts model (384 dims)
let _embeddingPipeline: any = null;
async function getEmbeddingPipeline() {
  if (!_embeddingPipeline) {
    _embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return _embeddingPipeline;
}

async function embedText(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();
  const output: any = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

export interface RfmFilters {
  status?: string;
  minLtv?: number;
  maxLtv?: number;
  minDaysSinceLastPurchase?: number;
  maxDaysSinceLastPurchase?: number;
  minRecencyScore?: number;
  maxRecencyScore?: number;
  minFrequencyScore?: number;
  maxFrequencyScore?: number;
  minMonetaryScore?: number;
  maxMonetaryScore?: number;
  minTotalOrders?: number;
  maxTotalOrders?: number;
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
  vectorLimit: number = 10000
): Promise<HybridSearchResult> {
  // Build Atlas $vectorSearch filter from RfmFilters.
  // IMPORTANT: $vectorSearch filter requires explicit MQL operators ({$gte: ...} not shorthand).
  // Only uses fields defined as "filter" type in the cortex_vector_index.
  const vectorFilter: Record<string, any> = {};

  if (rfmFilters.minLtv !== undefined || rfmFilters.maxLtv !== undefined) {
    vectorFilter['rfm.totalLifetimeValue'] = {};
    if (rfmFilters.minLtv !== undefined) vectorFilter['rfm.totalLifetimeValue'].$gte = rfmFilters.minLtv;
    if (rfmFilters.maxLtv !== undefined) vectorFilter['rfm.totalLifetimeValue'].$lte = rfmFilters.maxLtv;
  }
  if (rfmFilters.minDaysSinceLastPurchase !== undefined || rfmFilters.maxDaysSinceLastPurchase !== undefined) {
    vectorFilter['rfm.daysSinceLastPurchase'] = {};
    if (rfmFilters.minDaysSinceLastPurchase !== undefined) vectorFilter['rfm.daysSinceLastPurchase'].$gte = rfmFilters.minDaysSinceLastPurchase;
    if (rfmFilters.maxDaysSinceLastPurchase !== undefined) vectorFilter['rfm.daysSinceLastPurchase'].$lte = rfmFilters.maxDaysSinceLastPurchase;
  }
  if (rfmFilters.minRecencyScore !== undefined || rfmFilters.maxRecencyScore !== undefined) {
    vectorFilter['rfm.recencyScore'] = {};
    if (rfmFilters.minRecencyScore !== undefined) vectorFilter['rfm.recencyScore'].$gte = rfmFilters.minRecencyScore;
    if (rfmFilters.maxRecencyScore !== undefined) vectorFilter['rfm.recencyScore'].$lte = rfmFilters.maxRecencyScore;
  }
  if (rfmFilters.minFrequencyScore !== undefined || rfmFilters.maxFrequencyScore !== undefined) {
    vectorFilter['rfm.frequencyScore'] = {};
    if (rfmFilters.minFrequencyScore !== undefined) vectorFilter['rfm.frequencyScore'].$gte = rfmFilters.minFrequencyScore;
    if (rfmFilters.maxFrequencyScore !== undefined) vectorFilter['rfm.frequencyScore'].$lte = rfmFilters.maxFrequencyScore;
  }
  if (rfmFilters.minMonetaryScore !== undefined || rfmFilters.maxMonetaryScore !== undefined) {
    vectorFilter['rfm.monetaryScore'] = {};
    if (rfmFilters.minMonetaryScore !== undefined) vectorFilter['rfm.monetaryScore'].$gte = rfmFilters.minMonetaryScore;
    if (rfmFilters.maxMonetaryScore !== undefined) vectorFilter['rfm.monetaryScore'].$lte = rfmFilters.maxMonetaryScore;
  }
  if (rfmFilters.minTotalOrders !== undefined || rfmFilters.maxTotalOrders !== undefined) {
    vectorFilter['rfm.totalOrders'] = {};
    if (rfmFilters.minTotalOrders !== undefined) vectorFilter['rfm.totalOrders'].$gte = rfmFilters.minTotalOrders;
    if (rfmFilters.maxTotalOrders !== undefined) vectorFilter['rfm.totalOrders'].$lte = rfmFilters.maxTotalOrders;
  }
  // Status filter — use intent-extracted status, or default to ACTIVE
  vectorFilter['status'] = { $eq: rfmFilters.status || 'ACTIVE' };

  try {
    // Generate query embedding using the same model as ingestion (Xenova/all-MiniLM-L6-v2, 384 dims)
    const queryVector = await embedText(queryText);

    const searchPipeline: any[] = [
      {
        $vectorSearch: {
          index: 'cortex_vector_index',
          path: 'ai.embeddingVector',
          queryVector,
          numCandidates: Math.min(vectorLimit * 10, 10000),
          limit: vectorLimit,
          filter: vectorFilter,
        }
      },
      { $addFields: { searchScore: { $meta: 'vectorSearchScore' } } },
      { $match: { searchScore: { $gte: 0.65 } } }
    ];

    const results = await Shopper.aggregate(searchPipeline);
    
    let totalLtv = 0;
    let totalOrders = 0;
    for (const s of results) {
      if (s.rfm) {
        totalLtv += s.rfm.totalLifetimeValue || 0;
        totalOrders += s.rfm.totalOrders || 0;
      }
    }
    const audienceAov = totalOrders > 0 ? totalLtv / totalOrders : 0;

    console.log(`[rag.service] Vector search returned ${results.length} results for query: "${queryText}"`);
    return {
      shoppers: results as IShopper[],
      audienceSize: results.length,
      audienceAov,
      segmentQuery: vectorFilter,
    };
  } catch (err: any) {
    console.error('[rag.service] $vectorSearch failed:', err?.message || err);
    if (err?.codeName === 'IndexNotFound') {
      console.warn('[rag.service] Vector index not found — falling back to RFM filter only');
      const fallbackQuery = { ...vectorFilter, 'ai.embeddingVector': { $ne: null } };
      const shoppers = await Shopper.find(fallbackQuery).limit(vectorLimit);
      
      let fallbackLtv = 0;
      let fallbackOrders = 0;
      for (const s of shoppers) {
        if (s.rfm) {
          fallbackLtv += s.rfm.totalLifetimeValue || 0;
          fallbackOrders += s.rfm.totalOrders || 0;
        }
      }
      const fallbackAov = fallbackOrders > 0 ? fallbackLtv / fallbackOrders : 0;

      return { shoppers, audienceSize: shoppers.length, audienceAov: fallbackAov, segmentQuery: fallbackQuery };
    }
    throw err;
  }
}

// ── Deterministic Search (No Vector / No RAG) ────────────────────────────────
/**
 * Pure MongoDB filter search — used when the intent parser determines
 * no semantic search is needed (e.g., "customers who spent over $1000").
 */
export async function deterministicSearch(
  rfmFilters: RfmFilters
): Promise<HybridSearchResult> {
  const mongoQuery: Record<string, any> = {};

  if (rfmFilters.minLtv !== undefined || rfmFilters.maxLtv !== undefined) {
    mongoQuery['rfm.totalLifetimeValue'] = {};
    if (rfmFilters.minLtv !== undefined) mongoQuery['rfm.totalLifetimeValue'].$gte = rfmFilters.minLtv;
    if (rfmFilters.maxLtv !== undefined) mongoQuery['rfm.totalLifetimeValue'].$lte = rfmFilters.maxLtv;
  }
  if (rfmFilters.minDaysSinceLastPurchase !== undefined || rfmFilters.maxDaysSinceLastPurchase !== undefined) {
    mongoQuery['rfm.daysSinceLastPurchase'] = {};
    if (rfmFilters.minDaysSinceLastPurchase !== undefined) mongoQuery['rfm.daysSinceLastPurchase'].$gte = rfmFilters.minDaysSinceLastPurchase;
    if (rfmFilters.maxDaysSinceLastPurchase !== undefined) mongoQuery['rfm.daysSinceLastPurchase'].$lte = rfmFilters.maxDaysSinceLastPurchase;
  }
  if (rfmFilters.minRecencyScore !== undefined || rfmFilters.maxRecencyScore !== undefined) {
    mongoQuery['rfm.recencyScore'] = {};
    if (rfmFilters.minRecencyScore !== undefined) mongoQuery['rfm.recencyScore'].$gte = rfmFilters.minRecencyScore;
    if (rfmFilters.maxRecencyScore !== undefined) mongoQuery['rfm.recencyScore'].$lte = rfmFilters.maxRecencyScore;
  }
  if (rfmFilters.minFrequencyScore !== undefined || rfmFilters.maxFrequencyScore !== undefined) {
    mongoQuery['rfm.frequencyScore'] = {};
    if (rfmFilters.minFrequencyScore !== undefined) mongoQuery['rfm.frequencyScore'].$gte = rfmFilters.minFrequencyScore;
    if (rfmFilters.maxFrequencyScore !== undefined) mongoQuery['rfm.frequencyScore'].$lte = rfmFilters.maxFrequencyScore;
  }
  if (rfmFilters.minMonetaryScore !== undefined || rfmFilters.maxMonetaryScore !== undefined) {
    mongoQuery['rfm.monetaryScore'] = {};
    if (rfmFilters.minMonetaryScore !== undefined) mongoQuery['rfm.monetaryScore'].$gte = rfmFilters.minMonetaryScore;
    if (rfmFilters.maxMonetaryScore !== undefined) mongoQuery['rfm.monetaryScore'].$lte = rfmFilters.maxMonetaryScore;
  }
  if (rfmFilters.minTotalOrders !== undefined || rfmFilters.maxTotalOrders !== undefined) {
    mongoQuery['rfm.totalOrders'] = {};
    if (rfmFilters.minTotalOrders !== undefined) mongoQuery['rfm.totalOrders'].$gte = rfmFilters.minTotalOrders;
    if (rfmFilters.maxTotalOrders !== undefined) mongoQuery['rfm.totalOrders'].$lte = rfmFilters.maxTotalOrders;
  }
  // Status filter — use intent-extracted status, or default to ACTIVE
  mongoQuery['status'] = rfmFilters.status || 'ACTIVE';

  const shoppers = await Shopper.find(mongoQuery).lean();

  let totalLtv = 0;
  let totalOrders = 0;
  for (const s of shoppers) {
    if (s.rfm) {
      totalLtv += s.rfm.totalLifetimeValue || 0;
      totalOrders += s.rfm.totalOrders || 0;
    }
  }
  const audienceAov = totalOrders > 0 ? totalLtv / totalOrders : 0;

  console.log(`[rag.service] Deterministic search returned ${shoppers.length} results`);
  return {
    shoppers: shoppers as IShopper[],
    audienceSize: shoppers.length,
    audienceAov,
    segmentQuery: mongoQuery,
  };
}

// ── §7 + Tier-1 Fix 12.5: LLM Variant Generation with Validation ─────────────
export interface CampaignGenerationResult {
  variants: CampaignVariant[];
  recommendedChannels: string[];
}

/**
 * Calls Gemini ONCE to generate exactly 3 A/B/C campaign message variants and recommended channels.
 * Includes strict JSON schema validation + hardcoded fallback (Fix 12.5)
 * so campaign creation NEVER crashes even if the LLM returns garbage.
 */
export async function generateCampaignVariants(
  segmentDescription: string,
  goal: string,
  refinementPrompt?: string
): Promise<CampaignGenerationResult> {
  const prompt = `You are a CRM campaign copywriter. Generate exactly 3 message variants and recommend the best delivery channels (EMAIL, SMS, WHATSAPP) for a marketing campaign.

Target Segment: ${segmentDescription}
Campaign Goal: ${goal}
${refinementPrompt ? `\nUSER FEEDBACK / REFINEMENT REQUEST:\n${refinementPrompt}\nYou MUST follow this feedback heavily when generating the new variants.\n` : ''}
Rules:
- Generate EXACTLY 3 variants labeled A, B, C.
- Each template MUST contain the placeholder {{firstName}}.
- Keep each message under 160 characters.
- Vary tone: A=formal, B=friendly, C=urgency-driven.
- Recommend 1 to 3 delivery channels that would have the maximum impact for this specific audience and goal. Choose from: "EMAIL", "SMS", "WHATSAPP".
- Output ONLY valid JSON with NO markdown fences. Format:
{
  "recommendedChannels": ["EMAIL", "SMS"],
  "variants": [
    {"variantId": "A", "template": "...{{firstName}}..."},
    {"variantId": "B", "template": "...{{firstName}}..."},
    {"variantId": "C", "template": "...{{firstName}}..."}
  ]
}`;

  let rawText = '';
  try {
    const chatCompletion = await getGroq().chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a CRM campaign copywriter. Output ONLY valid JSON with NO markdown fences.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 500,
    });
    rawText = chatCompletion.choices[0]?.message?.content?.trim() || '';

    // Strip markdown fences if present (```json ... ```)
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (jsonMatch && jsonMatch[1]) ? jsonMatch[1].trim() : rawText;

    const parsed = JSON.parse(jsonStr);
    return validateAndReturnResult(parsed, segmentDescription);
  } catch (err) {
    console.error('[rag.service] LLM variant generation failed — using hardcoded fallback', err);
    return {
      variants: getHardcodedFallbackVariants(segmentDescription),
      recommendedChannels: ['EMAIL']
    };
  }
}

/**
 * ── Tier-1 Fix 12.5: Schema validation on LLM output ──
 * Validates that the parsed output contains exactly 3 valid variants and recommended channels.
 * Falls back to hardcoded templates if validation fails.
 */
function validateAndReturnResult(
  parsed: unknown,
  segmentDescription: string
): CampaignGenerationResult {
  const VALID_IDS = new Set(['A', 'B', 'C']);
  
  let targetArray: any = null;
  let recommendedChannels: string[] = ['EMAIL'];

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      targetArray = parsed;
    } else {
      if (Array.isArray((parsed as any).variants)) {
        targetArray = (parsed as any).variants;
      }
      if (Array.isArray((parsed as any).recommendedChannels)) {
        recommendedChannels = (parsed as any).recommendedChannels.filter((c: any) => typeof c === 'string');
      }
    }
  }

  const isValid =
    Array.isArray(targetArray) &&
    targetArray.length === 3 &&
    targetArray.every(
      (v: any) =>
        v &&
        typeof v.variantId === 'string' &&
        VALID_IDS.has(v.variantId) &&
        typeof v.template === 'string'
    );

  if (!isValid) {
    console.warn('[rag.service] LLM output failed schema validation. Parsed object:', JSON.stringify(parsed, null, 2));
    console.warn('[rag.service] Using fallback variants.');
    return {
      variants: getHardcodedFallbackVariants(segmentDescription),
      recommendedChannels: ['EMAIL']
    };
  }

  // Gracefully handle LLMs that forget the placeholder by auto-injecting it
  const validVariants = (targetArray as CampaignVariant[]).map(variant => {
    if (!variant.template.includes('{{firstName}}')) {
      variant.template = `Hey {{firstName}}, ${variant.template}`;
    }
    return variant;
  });

  return { variants: validVariants, recommendedChannels: recommendedChannels.length > 0 ? recommendedChannels : ['EMAIL'] };
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

/**
 * Refines a single specific variant based on user feedback.
 */
export async function refineSingleVariant(
  segmentDescription: string,
  goal: string,
  variantId: string,
  currentTemplate: string,
  refinementPrompt: string
): Promise<string> {
  const prompt = `You are a CRM campaign copywriter. You previously wrote this message (Variant ${variantId}) for a marketing campaign:
"${currentTemplate}"

Target Segment: ${segmentDescription}
Campaign Goal: ${goal}

USER FEEDBACK / REFINEMENT REQUEST:
${refinementPrompt}

Rewrite the message following the user's feedback.
Rules:
- Keep the message under 160 characters.
- MUST contain the placeholder {{firstName}}.
- Output ONLY the raw rewritten message string. DO NOT use JSON, DO NOT use quotes around the output, DO NOT output markdown. Just the raw text.`;

  try {
    const chatCompletion = await getGroq().chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a CRM copywriter. Output ONLY the raw message string without quotes or json.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 200,
    });
    let rawText = chatCompletion.choices[0]?.message?.content?.trim() || '';
    
    // Clean up quotes if the model adds them anyway
    if (rawText.startsWith('"') && rawText.endsWith('"')) {
      rawText = rawText.slice(1, -1);
    }
    
    if (!rawText.includes('{{firstName}}')) {
      rawText = `Hey {{firstName}}, ${rawText}`;
    }
    
    return rawText;
  } catch (err) {
    console.error('[rag.service] refineSingleVariant failed:', err);
    throw new Error('Failed to refine variant. Please try again.');
  }
}
