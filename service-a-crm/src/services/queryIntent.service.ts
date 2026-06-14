import Groq from 'groq-sdk';

let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return _groq;
}

export interface QueryIntent {
  needsSemanticSearch: boolean;
  semanticQuery: string | null;
  filters: {
    status?: string;
    minLtv?: number;
    maxLtv?: number;
    minDaysSinceLastPurchase?: number;
    maxDaysSinceLastPurchase?: number;
    minFrequencyScore?: number;
    maxFrequencyScore?: number;
    minMonetaryScore?: number;
    maxMonetaryScore?: number;
    minRecencyScore?: number;
    maxRecencyScore?: number;
    minTotalOrders?: number;
    maxTotalOrders?: number;
  };
  reasoning: string;
}

/**
 * LLM-powered query intent parser.
 * Analyzes a natural language query and returns:
 * 1. Structured RFM/status filters extracted from the query
 * 2. Whether semantic (vector) search is needed
 * 3. The semantic sub-query to embed (if applicable)
 * 4. A human-readable reasoning string for XAI transparency
 */
export async function parseQueryIntent(query: string): Promise<QueryIntent> {
  const systemPrompt = `You are a query router for an outdoor retail CRM database. Analyze the user's natural language search query and return a JSON object.

DATABASE FIELDS AVAILABLE FOR FILTERING:
- status: "ACTIVE", "INACTIVE", or "CHURNED"
- rfm.totalLifetimeValue: total dollars spent (use minLtv / maxLtv)
- rfm.daysSinceLastPurchase: days since last order (IMPORTANT: "last 15 days" means maxDaysSinceLastPurchase=15. "more than 30 days ago" means minDaysSinceLastPurchase=30)
- rfm.frequencyScore: number of orders (use minFrequencyScore / maxFrequencyScore)
- rfm.monetaryScore: same as totalLifetimeValue (use minMonetaryScore / maxMonetaryScore)
- rfm.recencyScore: same as daysSinceLastPurchase (use minRecencyScore / maxRecencyScore)
- rfm.totalOrders: total number of orders (use minTotalOrders / maxTotalOrders)

DECISION RULES:
- If the query is purely about numbers, thresholds, or status (e.g., "spent more than ₹1000", "inactive customers", "bought in the last 15 days"), set needsSemanticSearch to false. These are DETERMINISTIC queries.
- If the query involves behavioral traits, personality, preferences, or product affinity (e.g., "impulse hikers", "budget-conscious campers", "love winter sports"), set needsSemanticSearch to true. These need VECTOR SEARCH against customer profiles.
- If the query is HYBRID (e.g., "high-spending customers who love winter sports"), extract the numeric filters AND set needsSemanticSearch to true with the behavioral part as semanticQuery.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "needsSemanticSearch": true or false,
  "semanticQuery": "the behavioral/psychological part to search semantically" or null,
  "filters": {
    "status": "ACTIVE" (only if explicitly mentioned),
    "minLtv": number (only if mentioned, DO NOT OUTPUT null),
    "maxLtv": number (only if mentioned, DO NOT OUTPUT null),
    "minDaysSinceLastPurchase": number (only if mentioned, DO NOT OUTPUT null),
    "maxDaysSinceLastPurchase": number (only if mentioned, DO NOT OUTPUT null)
  },
  "reasoning": "1-2 sentence explanation of how you interpreted the query"
}

IMPORTANT: Only include filter keys that the user explicitly or implicitly mentioned. Do NOT invent filters. Do NOT output null values in the filters object.`;

  try {
    const response = await getGroq().chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 300,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    const filters = parsed.filters || {};
    
    // Strip nulls/undefined from filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === null || filters[key] === undefined) {
        delete filters[key];
      }
    });

    return {
      needsSemanticSearch: parsed.needsSemanticSearch ?? true,
      semanticQuery: parsed.semanticQuery ?? query,
      filters: filters,
      reasoning: parsed.reasoning ?? 'Unable to parse reasoning.',
    };
  } catch (err) {
    console.error('[queryIntent.service] LLM intent parsing failed — defaulting to semantic search', err);
    // Safe fallback: treat everything as semantic search with no filters
    return {
      needsSemanticSearch: true,
      semanticQuery: query,
      filters: {},
      reasoning: 'Intent parsing failed — falling back to full semantic search.',
    };
  }
}

export async function parseCampaignSearchIntent(query: string): Promise<Record<string, any>> {
  const systemPrompt = `You are a query router for a CRM campaign database. Translate the user's natural language search into a MongoDB filter query JSON object.

DATABASE FIELDS AVAILABLE:
- status: "DRAFT", "QUEUED", "EXECUTING", "OPTIMIZING", "COMPLETED", "FAILED"
- isSaved: boolean (e.g., "saved campaigns", "bookmarked")
- name: string
- goal: string
- channels: string array (e.g., "EMAIL", "SMS", "PUSH")
- minCtr: number (e.g., 10 for "CTR above 10%")
- maxCtr: number (e.g., 5 for "CTR below 5%")

RULES:
- For text concepts, use $regex on "name" or "goal" with $options: "i". Combine with $or if both can match.
- Map statuses strictly to uppercase enum values.
- Output ONLY the raw JSON object. Do not use markdown blocks.
- If the user asks for CTR filters, include "minCtr" and/or "maxCtr" at the top level of the JSON. Do NOT try to write complex mongo queries for CTR.

Example query: "completed email campaigns about winter with CTR over 10%"
Output: {"status":"COMPLETED","channels":"EMAIL","$or":[{"name":{"$regex":"winter","$options":"i"}},{"goal":{"$regex":"winter","$options":"i"}}],"minCtr":10}
`;

  try {
    const response = await getGroq().chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query }
      ],
      model: 'llama-3.1-8b-instant',
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 300,
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    // Intercept minCtr / maxCtr and convert to MongoDB $expr
    if (parsed.minCtr !== undefined || parsed.maxCtr !== undefined) {
      const ctrConditions = [];
      if (parsed.minCtr !== undefined) {
        ctrConditions.push({ "$gt": [ { "$divide": ["$$v.stats.clicks", "$$v.stats.sent"] }, parsed.minCtr / 100 ] });
        delete parsed.minCtr;
      }
      if (parsed.maxCtr !== undefined) {
        ctrConditions.push({ "$lt": [ { "$divide": ["$$v.stats.clicks", "$$v.stats.sent"] }, parsed.maxCtr / 100 ] });
        delete parsed.maxCtr;
      }

      parsed.$expr = {
        "$anyElementTrue": {
          "$map": {
            "input": "$variants",
            "as": "v",
            "in": {
              "$and": [
                { "$gt": ["$$v.stats.sent", 0] },
                ...ctrConditions
              ]
            }
          }
        }
      };
    }

    return parsed;
  } catch (err) {
    console.error('[queryIntent.service] parseCampaignSearchIntent failed', err);
    return { name: { $regex: query, $options: 'i' } }; // Fallback
  }
}
