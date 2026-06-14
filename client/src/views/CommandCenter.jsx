import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpportunities } from '../hooks/useOpportunities';
import { useLaunch } from '../hooks/useLaunch';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useDiscovery } from '../hooks/useDiscovery'; // needed to launch
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import './CommandCenter.css';

export default function CommandCenter() {
  const navigate = useNavigate();
  const { opportunities, loading: oppsLoading, error: oppsError, fetchOpportunities } = useOpportunities();
  const { launch, launching } = useLaunch();
  const { discover, results: discoveryResults } = useDiscovery();
  
  const [period, setPeriod] = useState('daily');
  const { stats, loading: statsLoading } = useDashboardStats(period);
  
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
      navigate('/campaigns', { state: { createCampaign: true, initialSegment: segment } });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="cc-container">
      {/* Left Panel: Opportunity Engine (40%) */}
      <section className="cc-left-panel custom-scrollbar">
        <div className="cc-left-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="font-headline-md text-primary m-0">Opportunity Engine</h2>
              <button 
                onClick={handleRunEngine} 
                disabled={runningEngine}
                className="btn-ghost"
                style={{ padding: '4px', display: 'flex', alignItems: 'center' }}
                title="Run Engine Now"
              >
                <span className={`material-symbols-outlined ${runningEngine ? 'rotating' : ''}`} style={{ fontSize: '20px' }}>
                  sync
                </span>
              </button>
            </div>
            <p className="font-label-md text-on-surface-variant m-0">Live AI-generated signals for growth</p>
          </div>
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
              <span className="kpi-value">${stats ? (stats.totalRevenue / 1000000).toFixed(1) + 'M' : '0.0M'}</span>
              <span className="kpi-trend" style={{ color: stats?.revenueTrend >= 0 ? 'var(--primary)' : 'var(--error)' }}>
                {stats?.revenueTrend >= 0 ? '+' : ''}{stats?.revenueTrend?.toFixed(0) || 0}%
              </span>
            </div>
          </div>
          <div className="kpi-block">
            <span className="kpi-label">Active Campaigns</span>
            <div className="kpi-value-group">
              <span className="kpi-value">{stats ? stats.activeCampaigns : 0}</span>
              <span className="material-symbols-outlined text-secondary">bolt</span>
            </div>
          </div>
          <div className="kpi-block">
            <span className="kpi-label">Global ROI</span>
            <div className="kpi-value-group">
              <span className="kpi-value">{stats ? stats.globalRoi.toFixed(1) : '0.0'}x</span>
              <span className="kpi-trend" style={{ color: stats?.globalRoi >= 3 ? 'var(--primary)' : 'var(--error)' }}>
                {stats?.globalRoi >= 3 ? 'Optimal' : 'Needs Review'}
              </span>
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
              <button 
                className={period === 'daily' ? 'btn-primary' : 'btn-ghost'} 
                onClick={() => setPeriod('daily')}
                style={period !== 'daily' ? { borderRadius: 'var(--radius-full)', border: '1px solid rgba(196,199,202,0.3)' } : {}}
              >
                Daily
              </button>
              <button 
                className={period === 'weekly' ? 'btn-primary' : 'btn-ghost'} 
                onClick={() => setPeriod('weekly')}
                style={period !== 'weekly' ? { borderRadius: 'var(--radius-full)', border: '1px solid rgba(196,199,202,0.3)' } : {}}
              >
                Weekly
              </button>
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            {statsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <span className="material-symbols-outlined rotating" style={{ color: 'var(--primary)', fontSize: '24px' }}>sync</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.trajectory || []} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--sienna)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--sienna)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--outline)', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface-container-high)', border: 'none', borderRadius: '8px', color: 'var(--on-surface)' }}
                    itemStyle={{ color: 'var(--sienna)', fontWeight: 'bold' }}
                    formatter={(value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="var(--sienna)" strokeWidth={3} fillOpacity={1} fill="url(#chartGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Activity Area */}
        <div className="activity-grid">
          <div>
            <h4 className="activity-section-title">Active Automations</h4>
            {stats?.activeAutomations?.length > 0 ? (
              stats.activeAutomations.map((auto) => (
                <div key={auto.id} className="activity-item" style={{ cursor: 'pointer' }} onClick={() => navigate(`/campaigns/${auto.id}`)}>
                  <div className="activity-icon"><span className="material-symbols-outlined text-secondary">{auto.status === 'EXECUTING' ? 'sync' : 'auto_awesome'}</span></div>
                  <div>
                    <p className="font-body-md" style={{ fontWeight: 600, margin: 0 }}>{auto.name}</p>
                    <p className="font-label-md" style={{ color: 'var(--on-surface-variant)', margin: 0 }}>AI Managed Workflow</p>
                  </div>
                  <span className="activity-status">ACTIVE</span>
                </div>
              ))
            ) : (
              <p className="font-body-md" style={{ color: 'var(--on-surface-variant)' }}>No active campaigns.</p>
            )}
          </div>
          <div>
            <h4 className="activity-section-title">AI System Logs</h4>
            <div className="log-container custom-scrollbar" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              {stats?.systemLogs?.map((log, index) => (
                <div key={index} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: index < stats.systemLogs.length - 1 ? '1px solid rgba(196,199,202,0.1)' : 'none' }}>
                  <span style={{ color: 'var(--sienna)', marginRight: '8px', fontFamily: 'var(--font-mono)' }}>{log.split(']')[0] + ']'}</span>
                  <span style={{ color: 'var(--on-surface)' }}>{log.split(']').slice(1).join(']')}</span>
                </div>
              )) || (
                <div>Real-time processing active... Analyzing consumer behavior patterns...</div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
