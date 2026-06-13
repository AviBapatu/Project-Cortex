import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://localhost:4000/api';
const POLL_INTERVAL_MS = 1500;

export interface VariantStats {
  variantId: 'A' | 'B' | 'C';
  sent: number;
  opens: number;
  clicks: number;
  ctr: number;        // click-through rate as percentage
  openRate: number;   // open rate as percentage
  isWinner: boolean;
}

export interface CampaignStats {
  campaignId: string;
  name: string;
  status: 'DRAFT' | 'EXECUTING' | 'OPTIMIZING' | 'COMPLETED' | 'FAILED';
  audienceSize: number;
  processed: number;
  failed: number;
  progressPct: number;
  winnerVariant: 'A' | 'B' | 'C' | null;
  explorationComplete: boolean;
  variants: VariantStats[];
}

export type StatsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'live'; data: CampaignStats }
  | { status: 'error'; message: string };

/**
 * useCampaignStats
 *
 * Polls GET /api/campaigns/:id/stats every 1.5 seconds while the campaign
 * is in an active state (EXECUTING or OPTIMIZING).
 *
 * Automatically stops polling when:
 *  - The campaign status becomes COMPLETED or FAILED
 *  - The component unmounts (interval is cleaned up — no memory leaks)
 *  - `enabled` is set to false
 *
 * Usage:
 *   const { state, stats } = useCampaignStats(campaignId);
 */
export function useCampaignStats(campaignId: string | null, enabled = true) {
  const [state, setState] = useState<StatsState>({ status: 'idle' });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const fetchStats = useCallback(async () => {
    if (!campaignId || !isMountedRef.current) return;

    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/stats`);
      const data = await res.json();

      if (!isMountedRef.current) return; // Guard against stale async response

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to fetch campaign stats.');
      }

      const stats: CampaignStats = data.stats;
      setState({ status: 'live', data: stats });

      // Auto-stop polling when campaign reaches a terminal state
      if (stats.status === 'COMPLETED' || stats.status === 'FAILED') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Unknown error.';
      setState({ status: 'error', message });
      // Stop polling on error — prevents hammering a broken endpoint
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [campaignId]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!campaignId || !enabled) {
      setState({ status: 'idle' });
      return;
    }

    // Initial fetch immediately — don't wait 1.5s for the first render
    setState({ status: 'loading' });
    fetchStats();

    // Start the polling interval
    intervalRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);

    // Cleanup: clear interval on unmount or when campaignId/enabled changes
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [campaignId, enabled, fetchStats]);

  const stats = state.status === 'live' ? state.data : null;
  const loading = state.status === 'loading';
  const error = state.status === 'error' ? state.message : null;

  return { state, stats, loading, error };
}
