import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export interface LaunchPayload {
  name: string;
  goal: string;
  segmentDescription: string;
  queryBreakdown?: any;
  rfmFilters?: Record<string, unknown>;
}

export type LaunchState =
  | { status: 'idle' }
  | { status: 'creating' }          // POST /api/campaigns
  | { status: 'queuing' }           // POST /api/campaigns/:id/launch
  | { status: 'launched'; campaignId: string }
  | { status: 'error'; message: string };

/**
 * useLaunch
 *
 * Orchestrates the campaign creation:
 *   1. POST /api/campaigns     → creates DRAFT, gets _id
 *
 * Usage:
 *   const { generate, state, reset } = useLaunch();
 *   const id = await generate({ name: 'Summer Hikers', goal: '20% off', segmentDescription: 'Impulsive hikers' });
 *   if (id) navigate(`/campaigns/${id}`);
 */
export function useLaunch() {
  const [state, setState] = useState<LaunchState>({ status: 'idle' });

  const launch = useCallback(async (payload: LaunchPayload) => {
    const { name, goal, segmentDescription, rfmFilters = {} } = payload;

    // ── Step 1: Create DRAFT campaign ──────────────────────────────────────
    setState({ status: 'creating' });
    let draftId: string;

    try {
      const createRes = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, goal, segmentDescription, rfmFilters }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || !createData.success) {
        throw new Error(createData.error ?? 'Failed to create campaign draft.');
      }

      draftId = createData.campaign._id as string;
      setState({
        status: 'launched',
        campaignId: draftId,
      });
      return draftId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign creation failed.';
      console.error('[useLaunch] create step failed:', err);
      setState({ status: 'error', message });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const launching = state.status === 'creating';
  const error = state.status === 'error' ? state.message : null;
  const launchedId = state.status === 'launched' ? state.campaignId : null;

  return { launch, state, reset, launching, error, launchedId };
}
