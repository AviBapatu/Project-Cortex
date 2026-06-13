import { type Request, type Response } from 'express';
import { hybridSearch, deterministicSearch, generateCampaignVariants } from '../services/rag.service.js';
import { parseQueryIntent } from '../services/queryIntent.service.js';

/**
 * POST /api/search/discover
 * Intelligent discovery pipeline:
 * 1. LLM parses natural language → extracts filters + decides if RAG is needed
 * 2. Routes to vector search (semantic) OR deterministic Mongo query
 * 3. Generates campaign variants
 * 4. Returns results + queryBreakdown for XAI transparency
 *
 * Body: { query: string }
 * Returns: { audienceSize, audienceSample, variants, queryBreakdown }
 */
export const discoverAudience = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      res.status(400).json({ success: false, error: 'Search query is required.' });
      return;
    }

    // ── Stage 1: LLM Intent Parsing ─────────────────────────────────────────
    // Groq analyzes the query → extracts structured filters + decides RAG vs deterministic
    console.log(`[search.controller] Parsing intent for: "${query.trim()}"`);
    const intent = await parseQueryIntent(query.trim());
    console.log(`[search.controller] Intent:`, JSON.stringify(intent, null, 2));

    // ── Stage 2: Smart Router ───────────────────────────────────────────────
    let searchResult;
    if (intent.needsSemanticSearch) {
      // Semantic path: Vector search + extracted filters
      console.log(`[search.controller] Routing to SEMANTIC search`);
      searchResult = await hybridSearch(intent.filters, intent.semanticQuery || query.trim());
    } else {
      // Deterministic path: Pure MongoDB filters, no vector search
      console.log(`[search.controller] Routing to DETERMINISTIC search`);
      searchResult = await deterministicSearch(intent.filters);
    }

    const { shoppers, audienceSize, segmentQuery } = searchResult;

    if (audienceSize === 0) {
      res.json({
        success: true,
        audienceSize: 0,
        audienceSample: [],
        variants: [],
        segmentQuery,
        queryBreakdown: {
          usedSemanticSearch: intent.needsSemanticSearch,
          extractedFilters: intent.filters,
          reasoning: intent.reasoning,
        },
      });
      return;
    }

    // ── Stage 3: Generate A/B/C variants for preview ────────────────────────
    const { variants } = await generateCampaignVariants(query.trim(), query.trim());

    // ── Stage 4: Return stateless preview payload with XAI breakdown ────────
    // Top 50 shoppers for the preview dashboard — strip embedding vectors (large)
    const audienceSample = shoppers.slice(0, 50).map(s => ({
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
      searchScore: (s as any).searchScore ?? null
    }));

    res.status(200).json({
      success: true,
      audienceSize,
      audienceSample,
      variants,
      segmentQuery,
      queryBreakdown: {
        usedSemanticSearch: intent.needsSemanticSearch,
        extractedFilters: intent.filters,
        reasoning: intent.reasoning,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Discovery pipeline failed.';
    console.error('[search.controller] discoverAudience error:', err);
    res.status(500).json({ success: false, error: message });
  }
};
