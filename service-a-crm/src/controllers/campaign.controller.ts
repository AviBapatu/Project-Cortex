import { type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Campaign } from '../models/Campaign.js';
import { hybridSearch, deterministicSearch, generateCampaignVariants, refineSingleVariant } from '../services/rag.service.js';
import { dispatchQueue } from '../queues/queues.js';

// ── POST /api/campaigns ────────────────────────────────────────────────────────
export async function createCampaign(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      goal,
      segmentDescription,
      queryBreakdown = {},
    } = req.body;

    if (!name || !goal || !segmentDescription) {
      res.status(400).json({ success: false, error: 'name, goal, and segmentDescription are required.' });
      return;
    }

    // Step 1: Use proper router based on intent
    const isSemantic = queryBreakdown.usedSemanticSearch !== false; // default to true if missing
    const filters = queryBreakdown.extractedFilters || {};
    
    let searchResult;
    if (isSemantic) {
      searchResult = await hybridSearch(filters, segmentDescription);
    } else {
      searchResult = await deterministicSearch(filters);
    }

    const { shoppers, audienceSize, audienceAov } = searchResult;

    if (audienceSize === 0) {
      res.status(404).json({ success: false, error: 'No matching shoppers found for this segment.' });
      return;
    }

    // Step 2: Generate 3 A/B/C variants via Gemini (with fallback)
    const { variants, recommendedChannels } = await generateCampaignVariants(segmentDescription, goal);

    // Step 3: Save Campaign as DRAFT
    const campaign = await Campaign.create({
      campaignId: uuidv4(),
      name,
      goal,
      segmentQuery: {
        isSemantic,
        filters,
        semanticQuery: segmentDescription
      },
      audienceSize,
      audienceAov: audienceAov || 0,
      channels: recommendedChannels || ['EMAIL'],
      variants,
      status: 'DRAFT',
    });

    res.status(201).json({
      success: true,
      campaign,
      audienceSample: shoppers.slice(0, 3).map(s => ({ customerId: s.customerId, firstName: s.firstName })),
    });
  } catch (error: any) {
    console.error('[campaign.controller] createCampaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /api/campaigns/:id/launch ────────────────────────────────────────────
// (Backpressure middleware runs before this)
export async function launchCampaign(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }
    if (campaign.status !== 'DRAFT') {
      res.status(409).json({ success: false, error: `Campaign is already ${campaign.status}. Only DRAFT campaigns can be launched.` });
      return;
    }

    // Re-run the correct search path to get the full audience list
    const sq = campaign.segmentQuery || {};
    let shoppers;
    
    // Check if it's the new format (has isSemantic) or the old buggy format
    if (sq.isSemantic !== undefined) {
      if (sq.isSemantic) {
        const result = await hybridSearch(sq.filters || {}, sq.semanticQuery);
        shoppers = result.shoppers;
      } else {
        const result = await deterministicSearch(sq.filters || {});
        shoppers = result.shoppers;
      }
    } else {
      // Fallback for old campaigns created before the fix
      const result = await hybridSearch({}, campaign.goal);
      shoppers = result.shoppers;
    }
    
    const initialBatchSize = Math.ceil(shoppers.length * 0.15);
    const initialBatch = shoppers.slice(0, initialBatchSize);

    // Enqueue the initial 15% batch — one job per shopper
    const jobs = initialBatch.map(shopper => ({
      name: 'dispatch',
      data: {
        campaignId: campaign.campaignId,
        customerId: shopper.customerId,
        // Round-robin A/B/C for the 15% batch
        variantId: campaign.variants[shoppers.indexOf(shopper) % campaign.variants.length]?.variantId ?? 'A',
      },
    }));

    await dispatchQueue.addBulk(jobs);
    await Campaign.updateOne({ _id: campaign._id }, { status: 'EXECUTING', audienceSize: shoppers.length });

    res.status(200).json({
      success: true,
      message: `Campaign launched. Dispatching initial ${initialBatchSize} of ${shoppers.length} messages (15%).`,
      campaignId: campaign.campaignId,
    });
  } catch (error: any) {
    console.error('[campaign.controller] launchCampaign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /api/campaigns ─────────────────────────────────────────────────────────
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const { status, isSaved, page = '1', limit = '20' } = req.query;
    const filter: Record<string, any> = {};
    if (status) filter.status = status;
    if (isSaved === 'true') filter.isSaved = true;

    const total = await Campaign.countDocuments(filter);
    const campaigns = await Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .limit(parseInt(limit as string))
      .select('-variants.template'); // Don't bloat list response

    res.json({ success: true, total, page: parseInt(page as string), campaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /api/campaigns/:id ─────────────────────────────────────────────────────
export async function getCampaign(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }
    res.json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── GET /api/campaigns/:id/stats ───────────────────────────────────────────────
// Merges live Redis bandit counters with MongoDB campaign state.
// Designed to be polled every 1-2 seconds from the Live Dashboard.
export async function getCampaignStats(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await Campaign.findById(req.params.id).select(
      'campaignId name status audienceSize audienceAov channels processed failed winnerVariant variants isSaved'
    );
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }

    // Pull live Redis counters — zero-safe (returns 0 when no data yet)
    const { getAllStats } = await import('../services/bandit.service.js');
    const banditStats = await getAllStats(campaign.campaignId);

    // Merge bandit counters into each variant
    const variantStats = campaign.variants.map(v => {
      const live = banditStats.find(b => b.variantId === v.variantId) ?? { sent: 0, opens: 0, clicks: 0 };
      const ctr = live.sent > 0 ? parseFloat(((live.clicks / live.sent) * 100).toFixed(1)) : 0;
      const openRate = live.sent > 0 ? parseFloat(((live.opens / live.sent) * 100).toFixed(1)) : 0;
      return {
        variantId: v.variantId,
        template: v.template,
        sent: live.sent,
        opens: live.opens,
        clicks: live.clicks,
        ctr,
        openRate,
        isWinner: campaign.winnerVariant === v.variantId,
      };
    });

    const pct = Math.min(100, (campaign.processed / Math.max(1, campaign.audienceSize)) * 100);
    const explorationComplete = campaign.status !== 'EXECUTING' && campaign.status !== 'DRAFT';

    res.json({
      success: true,
      stats: {
        campaignId: campaign.campaignId,
        name: campaign.name,
        status: campaign.status,
        audienceSize: campaign.audienceSize,
        audienceAov: campaign.audienceAov || 0,
        channels: campaign.channels || ['EMAIL'],
        processed: campaign.processed,
        failed: campaign.failed,
        progressPct: parseFloat(pct.toFixed(1)),
        winnerVariant: campaign.winnerVariant ?? null,
        explorationComplete,
        isSaved: campaign.isSaved,
        variants: variantStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /api/campaigns/:id/toggle-save ────────────────────────────────────────
export async function toggleSave(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }
    
    campaign.isSaved = !campaign.isSaved;
    await campaign.save();
    
    res.json({ success: true, isSaved: campaign.isSaved });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── PUT /api/campaigns/:id/channels ───────────────────────────────────────────
export async function updateCampaignChannels(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { channels } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }
    if (campaign.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'Can only edit channels when campaign is in DRAFT status.' });
      return;
    }

    campaign.channels = channels || ['EMAIL'];
    await campaign.save();

    res.json({ success: true, channels: campaign.channels });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── PUT /api/campaigns/:id/variants/:variantId ───────────────────────────────
export async function updateVariantTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id, variantId } = req.params;
    const { template } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }
    if (campaign.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'Can only edit variants when campaign is in DRAFT status.' });
      return;
    }

    const variant = campaign.variants.find(v => v.variantId === variantId);
    if (!variant) {
      res.status(404).json({ success: false, error: 'Variant not found.' });
      return;
    }

    variant.template = template;
    await campaign.save();

    res.json({ success: true, variant });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// ── POST /api/campaigns/:id/refine ───────────────────────────────────────────
export async function refineCampaignVariants(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { refinementPrompt, targetVariant } = req.body;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      res.status(404).json({ success: false, error: 'Campaign not found.' });
      return;
    }
    if (campaign.status !== 'DRAFT') {
      res.status(400).json({ success: false, error: 'Can only refine variants when campaign is in DRAFT status.' });
      return;
    }

    const sq = campaign.segmentQuery || {};
    const segmentDescription = sq.semanticQuery || campaign.goal;
    
    if (targetVariant && targetVariant !== 'ALL') {
      const variant = campaign.variants.find(v => v.variantId === targetVariant);
      if (!variant) {
        res.status(404).json({ success: false, error: 'Target variant not found.' });
        return;
      }
      const newTemplate = await refineSingleVariant(segmentDescription, campaign.goal, targetVariant, variant.template, refinementPrompt);
      variant.template = newTemplate;
    } else {
      const newGeneration = await generateCampaignVariants(segmentDescription, campaign.goal, refinementPrompt);
      // Completely replace variants
      campaign.variants = newGeneration.variants as any;
      if (newGeneration.recommendedChannels && newGeneration.recommendedChannels.length > 0) {
        campaign.channels = newGeneration.recommendedChannels;
      }
    }
    
    await campaign.save();

    res.json({ success: true, variants: campaign.variants });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
