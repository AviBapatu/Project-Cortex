import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis.js';
import { Shopper } from '../models/Shopper.js';
import { Opportunity } from '../models/Opportunity.js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const geminiFlash = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Segment rules for the opportunity engine.
 * Each rule has a deterministic Mongo query + a human-readable ID.
 */
const SEGMENT_RULES = [
  {
    segmentRuleId: 'CHURN_RISK_HIGH_LTV',
    ruleDefinition: {
      'rfm.daysSinceLastPurchase': { $gt: 90 },
      'rfm.totalLifetimeValue': { $gt: 1000 },
    },
    description: 'Customers with high lifetime value (>$1000) who haven\'t purchased in over 90 days',
  },
  {
    segmentRuleId: 'HIGH_FREQ_LOW_VALUE',
    ruleDefinition: {
      'rfm.frequencyScore': { $gte: 4 },
      'rfm.monetaryScore': { $lte: 2 },
    },
    description: 'Frequent buyers with low average order value — upsell opportunity',
  },
  {
    segmentRuleId: 'RECENT_ONE_TIME_BUYERS',
    ruleDefinition: {
      'rfm.totalOrders': { $lte: 2 },
      'rfm.recencyScore': { $gte: 4 },
    },
    description: 'Recent first-time or second-time buyers — convert to repeat customers',
  },
];

/**
 * Core opportunity engine logic — runs once per cron invocation.
 * Can also be called directly for testing (bypasses cron schedule).
 */
export async function runOpportunityEngine(): Promise<void> {
  console.log('[opportunityEngine] Starting scan...');

  for (const rule of SEGMENT_RULES) {
    const matches = await Shopper.find(rule.ruleDefinition).select('customerId').lean();
    const audienceMatchCount = matches.length;

    if (audienceMatchCount === 0) {
      console.log(`[opportunityEngine] Rule ${rule.segmentRuleId}: no matches. Skipping.`);
      continue;
    }

    // Check if a NEW opportunity for this rule already exists (avoid duplicates)
    const existing = await Opportunity.findOne({
      segmentRuleId: rule.segmentRuleId,
      status: 'NEW',
    });

    if (existing) {
      console.log(`[opportunityEngine] Rule ${rule.segmentRuleId}: active opportunity already exists. Skipping.`);
      continue;
    }

    // Single LLM call — STRICT prompt (Fix 12.7 boundary)
    const prompt = `You are a CRM analyst. Rephrase the following customer segment rule in plain English for a marketing manager.

Segment Rule: ${rule.description}
Audience Size: ${audienceMatchCount} customers

Rules:
- Write a title (under 10 words) and a description (2-3 sentences).
- Do NOT invent new criteria, thresholds, or segment definitions.
- Only rephrase what is provided above.
- Output ONLY valid JSON with NO markdown:
{"title": "...", "description": "..."}`;

    let llmTitle = rule.description;
    let llmDescription = rule.description;

    try {
      const res = await geminiFlash.generateContent(prompt);
      const rawText = res.response.text().trim();
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawText];
      const parsed = JSON.parse(jsonMatch[1]?.trim() || rawText);

      if (parsed.title && parsed.description) {
        llmTitle = parsed.title;
        llmDescription = parsed.description;
      }
    } catch (err) {
      console.warn(`[opportunityEngine] LLM call failed for ${rule.segmentRuleId} — using rule description as fallback`, err);
    }

    // Upsert opportunity
    await Opportunity.findOneAndUpdate(
      { segmentRuleId: rule.segmentRuleId, status: { $ne: 'NEW' } },
      {
        opportunityId: uuidv4(),
        segmentRuleId: rule.segmentRuleId,
        ruleDefinition: rule.ruleDefinition,
        audienceMatchCount,
        llmTitle,
        llmDescription,
        status: 'NEW',
      },
      { upsert: true, new: true }
    );

    console.log(`[opportunityEngine] Created opportunity: ${llmTitle} (${audienceMatchCount} matches)`);
  }

  console.log('[opportunityEngine] Scan complete.');
}
