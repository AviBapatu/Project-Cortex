import { type Request, type Response } from 'express';
import { hybridSearch, generateCampaignVariants } from '../services/rag.service.js';

/**
 * POST /api/search/discover
 * Stateless preview pipeline — runs hybrid search + variant generation
 * but does NOT persist anything to MongoDB.
 *
 * Body: { query: string, rfmFilters?: RfmFilters }
 * Returns: { audienceSize, audienceSample, variants, segmentQuery }
 */
export const discoverAudience = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, rfmFilters = {} } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      res.status(400).json({ success: false, error: 'Search query is required.' });
      return;
    }

    // ── Stage 1: Hybrid vector search (pure read — no DB writes) ──────────────
    const { shoppers, audienceSize, segmentQuery } = await hybridSearch(rfmFilters, query.trim());

    if (audienceSize === 0) {
      res.json({
        success: true,
        audienceSize: 0,
        audienceSample: [],
        variants: [],
        segmentQuery,
      });
      return;
    }

    // ── Stage 2: Generate A/B/C variants for preview ──────────────────────────
    // We pass the user's natural language query as both the segment description
    // and goal — the copywriter prompt will craft 3 messages targeting this intent.
    const variants = await generateCampaignVariants(query.trim(), query.trim());

    // ── Stage 3: Return stateless preview payload ─────────────────────────────
    // Only send top 5 shoppers to the frontend to keep the payload lean.
    // Strip the embedding vector from the sample (it's 768 floats — very large).
    const audienceSample = shoppers.slice(0, 5).map(s => ({
      customerId: s.customerId,
      firstName: s.firstName,
      lastName: s.lastName,
      status: s.status,
      rfm: {
        recencyScore: s.rfm?.recencyScore,
        frequencyScore: s.rfm?.frequencyScore,
        monetaryScore: s.rfm?.monetaryScore,
        totalLifetimeValue: s.rfm?.totalLifetimeValue,
      },
      digitalTwinSummary: s.ai?.digitalTwinSummary ?? null,
    }));

    res.status(200).json({
      success: true,
      audienceSize,
      audienceSample,
      variants,
      segmentQuery, // Frontend holds this and sends it back on launch
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery pipeline failed.';
    console.error('[search.controller] discoverAudience error:', err);
    res.status(500).json({ success: false, error: message });
  }
};
