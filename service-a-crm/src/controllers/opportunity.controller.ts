import { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Opportunity } from '../models/Opportunity.js';
import { Campaign } from '../models/Campaign.js';
import { generateCampaignVariants, hybridSearch } from '../services/rag.service.js';

// ── GET /api/opportunities ─────────────────────────────────────────────────────
export async function listOpportunities(req: Request, res: Response): Promise<void> {
  try {
    const { status = 'NEW', page = '1', limit = '20' } = req.query;
    const filter: Record<string, any> = {};
    if (status !== 'all') filter.status = status;

    const total = await Opportunity.countDocuments(filter);
    const opportunities = await Opportunity.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .limit(parseInt(limit as string));

    res.json({ success: true, total, opportunities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /api/opportunities/:id ─────────────────────────────────────────────────
export async function getOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) {
      res.status(404).json({ success: false, error: 'Opportunity not found.' });
      return;
    }
    res.json({ success: true, opportunity });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /api/opportunities/:id/convert ───────────────────────────────────────
/**
 * Converts an Opportunity into a Campaign DRAFT.
 * Pre-fills segmentQuery from the opportunity's ruleDefinition — ensuring
 * the campaign uses the SAME deterministic rule, not an LLM-invented one.
 */
export async function convertOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const opportunity = await Opportunity.findById(req.params.id);
    if (!opportunity) {
      res.status(404).json({ success: false, error: 'Opportunity not found.' });
      return;
    }
    if (opportunity.status !== 'NEW') {
      res.status(409).json({ success: false, error: `Opportunity is already ${opportunity.status}.` });
      return;
    }

    const goal = req.body.goal || opportunity.llmTitle;
    const segmentDescription = opportunity.llmDescription;

    // Use the opportunity's ruleDefinition as the segment query directly
    const { shoppers, audienceSize } = await hybridSearch(
      opportunity.ruleDefinition,
      segmentDescription
    );

    if (audienceSize === 0) {
      res.status(404).json({ success: false, error: 'No matching shoppers for this opportunity segment.' });
      return;
    }

    const variants = await generateCampaignVariants(segmentDescription, goal);

    const campaign = await Campaign.create({
      campaignId: uuidv4(),
      name: `[From Opportunity] ${opportunity.llmTitle}`,
      goal,
      segmentQuery: opportunity.ruleDefinition,
      audienceSize,
      variants,
      status: 'DRAFT',
    });

    // Mark opportunity as converted
    await Opportunity.updateOne({ _id: opportunity._id }, { status: 'CONVERTED_TO_CAMPAIGN' });

    res.status(201).json({ success: true, campaign });
  } catch (error: any) {
    console.error('[opportunity.controller] convertOpportunity error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── PATCH /api/opportunities/:id/dismiss ──────────────────────────────────────
export async function dismissOpportunity(req: Request, res: Response): Promise<void> {
  try {
    const result = await Opportunity.findByIdAndUpdate(
      req.params.id,
      { status: 'DISMISSED' },
      { new: true }
    );
    if (!result) {
      res.status(404).json({ success: false, error: 'Opportunity not found.' });
      return;
    }
    res.json({ success: true, opportunity: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
