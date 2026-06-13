import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:4000/api';

/**
 * Shape of a single audience preview shopper returned from the discover endpoint.
 */
export interface AudienceMember {
  customerId: string;
  firstName: string;
  lastName: string;
  status: string;
  rfm: {
    recencyScore: number;
    frequencyScore: number;
    monetaryScore: number;
    totalLifetimeValue: number;
  };
  digitalTwinSummary: string | null;
}

/**
 * Shape of a single AI-generated campaign variant.
 * Note: backend returns `template`, not `copy`.
 */
export interface CampaignVariant {
  variantId: 'A' | 'B' | 'C';
  template: string;
}

/**
 * The full discovery result held in state after a successful call.
 * `segmentQuery` is passed back to the launch endpoint so the frontend
 * never needs to re-run the search.
 */
export interface DiscoveryResult {
  audienceSize: number;
  audienceSample: AudienceMember[];
  variants: CampaignVariant[];
  segmentQuery: Record<string, unknown>;
}

export type DiscoveryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: DiscoveryResult }
  | { status: 'error'; message: string };

/**
 * useDiscovery
 *
 * Encapsulates all state and fetch logic for the stateless discovery preview
 * pipeline: POST /api/search/discover → audienceSize + audienceSample + variants.
 *
 * Usage:
 *   const { state, discover, reset } = useDiscovery();
 *   discover("Find impulsive weekend hikers");
 */
export function useDiscovery() {
  const [state, setState] = useState<DiscoveryState>({ status: 'idle' });

  const discover = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setState({ status: 'loading' });

    try {
      const res = await fetch(`${API_BASE}/search/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Discovery pipeline failed.');
      }

      setState({
        status: 'success',
        data: {
          audienceSize: data.audienceSize,
          audienceSample: data.audienceSample,
          variants: data.variants,
          segmentQuery: data.segmentQuery,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error.';
      setState({ status: 'error', message });
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  // Derived convenience flags for the UI
  const loading = state.status === 'loading';
  const error = state.status === 'error' ? state.message : null;
  const results = state.status === 'success' ? state.data : null;

  return { state, discover, reset, loading, error, results };
}
