import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpportunities } from '../hooks/useOpportunities';
import { useLaunch } from '../hooks/useLaunch';
import { useCampaignStats } from '../hooks/useCampaignStats';
import { useDiscovery } from '../hooks/useDiscovery'; // needed to launch
import './CommandCenter.css';

export default function CommandCenter() {
  const navigate = useNavigate();
  const { opportunities, loading: oppsLoading, error: oppsError, fetchOpportunities } = useOpportunities();
  const { launch, launching } = useLaunch();
  const { discover, results: discoveryResults } = useDiscovery();
  const { stats, loading: statsLoading } = useCampaignStats(null, false); // Assuming global stats for now
  
  const [runningEngine, setRunningEngine] = useState(false);

  const handleRunEngine = async () => {
    setRunningEngine(true);
    try {
      await fetch('http://localhost:4000/api/opportunities/run', { method: 'POST' });
      await fetchOpportunities();
    } catch (err) {
      console.error('Failed to run engine manually', err);
    } finally {
      setRunningEngine(false);
    }
  };

  const handleToggleSaveOpp = async (oppId) => {
    try {
      await fetch(`http://localhost:4000/api/opportunities/${oppId}/toggle-save`, { method: 'POST' });
      await fetchOpportunities(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateCampaign = async (segment) => {
    // Quick discover then launch
    try {
      // In a real flow, this might navigate to audience discovery or launch directly
      // We will just navigate to campaigns for now since the flow is complex
      navigate('/campaigns');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="cc-container">
      {/* Left Panel: Opportunity Engine (40%) */}
      <section className="cc-left-panel custom-scrollbar">
        <div className="cc-left-header">
          <div>
            <h2 className="font-headline-md text-primary m-0">Opportunity Engine</h2>
            <p className="font-label-md text-on-surface-variant m-0">Live AI-generated signals for growth</p>
          </div>
          <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1", animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>auto_awesome</span>
        </div>

        <div className="cc-opps-list">
          {oppsLoading ? (
            <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', textAlign: 'center' }}>Loading opportunities...</p>
          ) : oppsError ? (
            <p className="font-body-md" style={{ color: 'var(--error)' }}>Failed to load opportunities</p>
          ) : opportunities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <button className="btn-secondary" onClick={handleRunEngine} disabled={runningEngine}>
                {runningEngine ? 'Scanning...' : 'Run Engine Now'}
              </button>
            </div>
          ) : (
            opportunities.map(opp => (
              <div key={opp._id} className="ai-gradient-border ai-glow">
                <div className="opp-card-inner">
                  <div className="opp-card-header">
                    <div className="opp-card-badge">
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sparkles</span>
                      <span>{opp.isSaved ? 'SAVED' : 'SIGNAL'}</span>
                    </div>
                    <span className="opp-card-match">{opp.audienceMatchCount} Matches</span>
                  </div>
                  <h3 className="opp-card-title">{opp.llmTitle}</h3>
                  <p className="opp-card-desc">{opp.llmDescription}</p>
                  
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button 
                      className="opp-card-btn"
                      onClick={() => handleGenerateCampaign(opp.llmDescription)}
                    >
                      Target Segment
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
                    </button>
                    <button 
                      className="btn-secondary"
                      onClick={() => handleToggleSaveOpp(opp._id)}
                      style={{ padding: '0 16px', borderRadius: 'var(--radius-full)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: opp.isSaved ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Right Panel: Analytics & Workspace (60%) */}
      <section className="cc-right-panel custom-scrollbar">
        {/* Hero KPI Row */}
        <div className="hero-kpis">
          <div className="kpi-block">
            <span className="kpi-label">Total Revenue</span>
            <div className="kpi-value-group">
              <span className="kpi-value">$4.2M</span>
              <span className="kpi-trend">+12%</span>
            </div>
          </div>
          <div className="kpi-block">
            <span className="kpi-label">Active Campaigns</span>
            <div className="kpi-value-group">
              <span className="kpi-value">84</span>
              <span className="material-symbols-outlined text-secondary">bolt</span>
            </div>
          </div>
          <div className="kpi-block">
            <span className="kpi-label">Global ROI</span>
            <div className="kpi-value-group">
              <span className="kpi-value">3.8x</span>
              <span className="kpi-trend">Optimal</span>
            </div>
          </div>
        </div>

        {/* Revenue Chart Placeholder */}
        <div className="chart-card">
          <div className="flex-row justify-between" style={{ marginBottom: '32px' }}>
            <div>
              <h3 className="font-headline-md text-primary m-0">Performance Trajectory</h3>
              <p className="font-label-md text-on-surface-variant m-0">Revenue growth vs. AI optimization efficiency</p>
            </div>
            <div className="flex-row gap-sm">
              <button className="btn-ghost" style={{ borderRadius: 'var(--radius-full)', border: '1px solid rgba(196,199,202,0.3)' }}>Daily</button>
              <button className="btn-primary">Weekly</button>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 800 240" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--sienna)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--sienna)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid */}
              <line stroke="rgba(196,199,202,0.2)" strokeWidth="1" x1="0" x2="800" y1="40" y2="40" />
              <line stroke="rgba(196,199,202,0.2)" strokeWidth="1" x1="0" x2="800" y1="100" y2="100" />
              <line stroke="rgba(196,199,202,0.2)" strokeWidth="1" x1="0" x2="800" y1="160" y2="160" />
              
              {/* Spline */}
              <path d="M0,200 C100,180 150,190 200,140 S300,60 400,100 S500,120 600,60 S700,40 800,20 L800,240 L0,240 Z" fill="url(#chartGradient)" />
              <path d="M0,200 C100,180 150,190 200,140 S300,60 400,100 S500,120 600,60 S700,40 800,20" fill="none" stroke="var(--sienna)" strokeLinecap="round" strokeWidth="3" />
              
              <circle cx="200" cy="140" fill="var(--sienna)" r="4" />
              <circle cx="400" cy="100" fill="var(--sienna)" r="4" />
              <circle cx="600" cy="60" fill="var(--sienna)" r="4" />
            </svg>
          </div>
        </div>

        {/* Activity Area */}
        <div className="activity-grid">
          <div>
            <h4 className="activity-section-title">Active Automations</h4>
            <div className="activity-item">
              <div className="activity-icon"><span className="material-symbols-outlined text-secondary">sync</span></div>
              <div>
                <p className="font-body-md" style={{ fontWeight: 600, margin: 0 }}>Weekly Win-Back Flow</p>
                <p className="font-label-md" style={{ color: 'var(--on-surface-variant)', margin: 0 }}>Running in APAC, EMEA regions</p>
              </div>
              <span className="activity-status">ACTIVE</span>
            </div>
            <div className="activity-item">
              <div className="activity-icon"><span className="material-symbols-outlined text-secondary">mail</span></div>
              <div>
                <p className="font-body-md" style={{ fontWeight: 600, margin: 0 }}>VIP Early Access</p>
                <p className="font-label-md" style={{ color: 'var(--on-surface-variant)', margin: 0 }}>92% Engagement rate</p>
              </div>
              <span className="activity-status">ACTIVE</span>
            </div>
          </div>
          <div>
            <h4 className="activity-section-title">AI System Logs</h4>
            <div className="log-container">
              Real-time processing active... Analyzing consumer behavior patterns...
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
