import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:4000/api';

export interface Opportunity {
  _id: string;
  opportunityId: string;
  segmentRuleId: string;
  ruleDefinition: Record<string, any>;
  audienceMatchCount: number;
  llmTitle: string;
  llmDescription: string;
  status: 'NEW' | 'CONVERTED_TO_CAMPAIGN' | 'DISMISSED';
  createdAt: string;
  updatedAt: string;
}

export type OpportunitiesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: Opportunity[] }
  | { status: 'error'; message: string };

export function useOpportunities() {
  const [state, setState] = useState<OpportunitiesState>({ status: 'idle' });

  const fetchOpportunities = useCallback(async (silent = false) => {
    if (!silent) setState(prev => prev.status === 'success' ? prev : { status: 'loading' });
    try {
      const res = await fetch(`${API_BASE}/opportunities?status=NEW`);
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch opportunities');
      }

      setState({
        status: 'success',
        data: data.opportunities || []
      });
    } catch (err: any) {
      setState({
        status: 'error',
        message: err.message || 'Unknown error'
      });
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const loading = state.status === 'loading';
  const error = state.status === 'error' ? state.message : null;
  const opportunities = state.status === 'success' ? state.data : [];

  return { state, fetchOpportunities, loading, error, opportunities };
}
