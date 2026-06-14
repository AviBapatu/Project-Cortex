import { Groq } from 'groq-sdk';
import { v4 as uuidv4 } from 'uuid';
import redis from '../config/redis.js';
import { Shopper } from '../models/Shopper.js';
import { Opportunity } from '../models/Opportunity.js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
    description: 'Customers with high lifetime value (>₹1000) who haven\'t purchased in over 90 days',
  },
  {
    segmentRuleId: 'HIGH_FREQ_LOW_VALUE',
    ruleDefinition: {
      'rfm.frequencyScore': { $gte: 4 },
      'rfm.monetaryScore': { $lte: 200 },
    },
    description: 'Frequent buyers with low average order value — upsell opportunity',
  },
  {
    segmentRuleId: 'RECENT_ONE_TIME_BUYERS',
    ruleDefinition: {
      'rfm.totalOrders': { $lte: 2 },
      'rfm.recencyScore': { $gte: 4, $lte: 30 },
    },
    description: 'Recent first-time or second-time buyers — convert to repeat customers',
  },
  {
    segmentRuleId: 'WHALE_RETENTION',
    ruleDefinition: {
      'rfm.monetaryScore': { $gte: 2000 },
      'rfm.daysSinceLastPurchase': { $lte: 60 },
    },
    description: 'Top spenders who recently purchased — engage for VIP loyalty programs',
  },
  {
    segmentRuleId: 'SLEEPING_BEAUTIES',
    ruleDefinition: {
      'rfm.frequencyScore': { $gte: 3 },
      'rfm.daysSinceLastPurchase': { $gt: 180 },
    },
    description: 'Historically frequent buyers who went dormant over 6 months ago',
  },
  {
    segmentRuleId: 'IMPULSE_HIKERS',
    ruleDefinition: {
      'rfm.frequencyScore': { $gte: 10 },
      'rfm.daysSinceLastPurchase': { $lte: 14 },
    },
    description: 'Highly active impulsive buyers who buy frequently with high recent activity',
  },
  {
    segmentRuleId: 'SEASONAL_SNOW_ADDICTS',
    ruleDefinition: {
      'rfm.totalLifetimeValue': { $gte: 500 },
      'rfm.daysSinceLastPurchase': { $gte: 15, $lte: 180 },
    },
    description: 'Seasonal buyers with high value but moderate to long recency gaps',
  }
];

async function saveOpportunity(segmentRuleId: string, ruleDefinition: any, audienceMatchCount: number, title: string, description: string) {
  const existing = await Opportunity.findOne({
    segmentRuleId,
    status: 'NEW',
  });

  if (existing) {
    console.log(`[opportunityEngine] Rule ${segmentRuleId}: active opportunity already exists. Skipping.`);
    return;
  }

  await Opportunity.findOneAndUpdate(
    { segmentRuleId, status: { $ne: 'NEW' } },
    {
      opportunityId: uuidv4(),
      segmentRuleId,
      ruleDefinition,
      audienceMatchCount,
      llmTitle: title,
      llmDescription: description,
      status: 'NEW',
    },
    { upsert: true, new: true }
  );

  console.log(`[opportunityEngine] Created opportunity: ${title} (${audienceMatchCount} matches)`);
}

/**
 * Core opportunity engine logic — runs once per cron invocation.
 * Combines heuristics and AI:
 * 1. Runs base heuristics to gather DB stats.
 * 2. Feeds stats to Groq to generate novel AI segments.
 * 3. Evaluates and saves both heuristic and AI segments.
 */
export async function runOpportunityEngine(): Promise<void> {
  console.log('[opportunityEngine] Starting heuristic scan...');

  const heuristicResults: { id: string, desc: string, count: number }[] = [];

  // Phase 1: Run Heuristics
  for (const rule of SEGMENT_RULES) {
    const matches = await Shopper.find(rule.ruleDefinition).select('customerId').lean();
    const audienceMatchCount = matches.length;
    
    heuristicResults.push({ id: rule.segmentRuleId, desc: rule.description, count: audienceMatchCount });

    if (audienceMatchCount > 0) {
      // Save heuristic opportunity directly with a basic title format
      const basicTitle = rule.segmentRuleId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      await saveOpportunity(rule.segmentRuleId, rule.ruleDefinition, audienceMatchCount, basicTitle, rule.description);
    }
  }

  // Phase 2: AI Generation based on Heuristic baseline
  console.log('[opportunityEngine] Prompting Groq for AI-generated segments...');
  
  const heuristicText = heuristicResults.map(r => `- ${r.desc}: ${r.count} matches`).join('\n');
  
  const prompt = `You are an expert CRM Data Analyst. We ran our base heuristic segment rules on our database and got these results:
${heuristicText}

The available shopper schema fields for RFM are:
- rfm.recencyScore (number 1-5, 5 is most recent)
- rfm.frequencyScore (number 1-5, 5 is most frequent)
- rfm.monetaryScore (number 1-5, 5 is highest spending)
- rfm.totalLifetimeValue (number in dollars)
- rfm.daysSinceLastPurchase (number in days)
- rfm.totalOrders (number of orders)

Generate exactly 2 NEW, novel, highly-targeted marketing opportunity segments by combining these fields to find untapped potential. Do not duplicate the base rules.
Output a JSON array of objects. Each object must have:
- "segmentRuleId": a unique uppercase string (e.g., "AI_HIGH_VALUE_AT_RISK")
- "ruleDefinition": a valid MongoDB query object using the fields above (e.g., {"rfm.totalLifetimeValue":{"$gt":500},"rfm.recencyScore":{"$lte":2}})
- "title": A short catchy marketing title (under 5 words)
- "description": A 1-2 sentence description for a marketer explaining why this segment is valuable

Output ONLY valid JSON. No markdown formatting, no code blocks, just the JSON array.`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    let rawText = completion.choices[0]?.message?.content?.trim() || '[]';
    
    // Safety fallback: sometimes models wrap JSON in {"segments": [...]} when response_format is json_object
    let parsedData;
    try {
      parsedData = JSON.parse(rawText);
      if (parsedData.segments && Array.isArray(parsedData.segments)) {
        parsedData = parsedData.segments;
      } else if (parsedData.opportunities && Array.isArray(parsedData.opportunities)) {
        parsedData = parsedData.opportunities;
      } else if (!Array.isArray(parsedData) && typeof parsedData === 'object') {
        // If it returns a single object that isn't an array
        const keys = Object.keys(parsedData);
        if (keys.length > 0 && Array.isArray((parsedData as Record<string, any>)[keys[0] as string])) {
          parsedData = (parsedData as Record<string, any>)[keys[0] as string];
        } else {
          parsedData = [parsedData]; // wrap it
        }
      }
    } catch (e) {
      console.error('[opportunityEngine] Failed to parse Groq response:', rawText);
      parsedData = [];
    }

    if (!Array.isArray(parsedData)) {
      console.error('[opportunityEngine] Groq did not return an array. Data:', parsedData);
      return;
    }

    for (const aiRule of parsedData) {
      if (!aiRule.segmentRuleId || !aiRule.ruleDefinition || !aiRule.title || !aiRule.description) {
        console.warn('[opportunityEngine] AI segment missing required fields, skipping:', aiRule);
        continue;
      }

      // Ensure segmentRuleId has an AI_ prefix for clarity
      const ruleId = aiRule.segmentRuleId.startsWith('AI_') ? aiRule.segmentRuleId : `AI_${aiRule.segmentRuleId}`;

      console.log(`[opportunityEngine] Testing AI segment: ${ruleId}`);
      
      try {
        const matches = await Shopper.find(aiRule.ruleDefinition).select('customerId').lean();
        const audienceMatchCount = matches.length;

        if (audienceMatchCount > 0) {
          await saveOpportunity(ruleId, aiRule.ruleDefinition, audienceMatchCount, aiRule.title, aiRule.description);
        } else {
          console.log(`[opportunityEngine] AI segment ${ruleId} had 0 matches.`);
        }
      } catch (dbErr) {
        console.error(`[opportunityEngine] AI generated invalid Mongo query for ${ruleId}:`, dbErr);
      }
    }

  } catch (err) {
    console.error('[opportunityEngine] Groq AI generation failed:', err);
  }

  console.log('[opportunityEngine] Scan complete.');
}
