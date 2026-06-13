import { useState, useCallback } from 'react';

const API_BASE = 'http://localhost:4000/api';

export interface LaunchPayload {
  name: string;
  goal: string;
  segmentDescription: string;
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
 * Orchestrates the 2-step campaign launch flow:
 *   1. POST /api/campaigns     → creates DRAFT, gets _id
 *   2. POST /api/campaigns/:id/launch → pushes 15% batch to BullMQ, returns campaignId
 *
 * The backend owns segmentQuery and variants — the frontend does NOT re-send them.
 * They are read from MongoDB by the launch controller.
 *
 * Usage:
 *   const { launch, state, reset } = useLaunch();
 *   await launch({ name: 'Summer Hikers', goal: '20% off', segmentDescription: 'Impulsive hikers' });
 *   if (state.status === 'launched') navigate to CampaignDetail with state.campaignId
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign creation failed.';
      console.error('[useLaunch] create step failed:', err);
      setState({ status: 'error', message });
      return;
    }

    // ── Step 2: Launch — push 15% batch to BullMQ ─────────────────────────
    setState({ status: 'queuing' });

    try {
      const launchRes = await fetch(`${API_BASE}/campaigns/${draftId}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const launchData = await launchRes.json();

      if (!launchRes.ok || !launchData.success) {
        // Campaign was created but queue failed — still navigate, detail page shows status
        const message = launchData.error ?? 'Queue initialization failed.';
        console.error('[useLaunch] launch step failed:', message);
        // Surface as error but still expose the draftId so UI can retry
        setState({
          status: 'error',
          message: `Campaign saved (ID: ${draftId}) but queue failed: ${message}. Open the campaign and retry launch.`,
        });
        return;
      }

      setState({
        status: 'launched',
        campaignId: draftId, // Use MongoDB _id for the detail view route
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Queue initialization failed.';
      console.error('[useLaunch] launch step failed:', err);
      setState({
        status: 'error',
        message: `Campaign draft saved but queue failed to initialize: ${message}`,
      });
    }
  }, []);

  const reset = useCallback(() => setState({ status: 'idle' }), []);

  const launching = state.status === 'creating' || state.status === 'queuing';
  const error = state.status === 'error' ? state.message : null;
  const launchedId = state.status === 'launched' ? state.campaignId : null;

  return { launch, state, reset, launching, error, launchedId };
}
