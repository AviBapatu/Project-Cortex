import React, { useState } from 'react';
import { Sparkles, Search, Activity, Target, Zap, Users, BrainCircuit } from 'lucide-react';
import { useDiscovery } from '../hooks/useDiscovery';
import { useLaunch } from '../hooks/useLaunch';
import { useCampaignStats } from '../hooks/useCampaignStats';
import './CommandCenter.css';

const OPPORTUNITIES = [
  { id: 1, title: 'Churning Whales', gap: '$124k', desc: 'High LTV customers who haven\'t purchased in 90+ days. Prime for re-engagement.', segment: 'High-value shoppers who haven\'t bought in 90 days' },
  { id: 2, title: 'Impulsive Hikers', gap: '$45k', desc: 'Frequent buyers of outdoor gear during weekend hours. Highly responsive to flash sales.', segment: 'Weekend impulse buyers who spent over $50 on outdoor gear' },
  { id: 3, title: 'Discount Loyalists', gap: '$82k', desc: 'Engage exclusively with >20% discounts but purchase in high volumes.', segment: 'Shoppers who only buy when discounts exceed 20%' },
];

export default function CommandCenter() {
  const [query, setQuery] = useState('');
  
  // Real Hooks
  const { discover, loading: discovering, error: discoverError, results: discoveryResults } = useDiscovery();
  const { launch, launching, error: launchError, launchedId } = useLaunch();
  const { stats, loading: statsLoading } = useCampaignStats(launchedId, !!launchedId);

  // Handle clicking an opportunity
  const handleSelectOpportunity = (segment) => {
    setQuery(segment);
    discover(segment);
  };

  const handleSearch = () => {
    if (query.trim()) {
      discover(query);
    }
  };

  const handleGenerateCampaign = async () => {
    if (!discoveryResults) return;
    await launch({
      name: `Campaign: ${query.substring(0, 20)}...`,
      goal: query.trim(),
      segmentDescription: query.trim(),
    });
  };

  // Determine what to show in the discovery section
  const audienceLocked = !!discoveryResults;
  const audienceSize = discoveryResults?.audienceSize || 0;
  const twins = discoveryResults?.audienceSample || [];

  // Determine what to show in the dashboard section
  const campaignActive = !!launchedId;
  const campaignStatus = stats?.status || 'GENERATING';
  const progressPct = stats?.progressPct || 0;
  
  // Merge discovery variants (templates) with live stats if available
  const baseVariants = discoveryResults?.variants || [];
  const variants = baseVariants.map(bv => {
    const stat = stats?.variants?.find(sv => sv.variantId === bv.variantId);
    return {
      id: bv.variantId,
      copy: bv.template,
      dispatches: stat?.sent || 0,
      clicks: stat?.clicks || 0,
      ctr: stat?.ctr || 0,
      status: stat?.isWinner ? 'WINNING' : (stats?.winnerVariant ? 'KILLED' : 'TESTING')
    };
  });

  return (
    <div className="cc-container">
      
      {/* 1. Opportunity Engine */}
      <section>
        <h2 className="cc-section-title"><Sparkles size={18} /> Opportunity Engine</h2>
        <div className="cc-opp-grid">
          {OPPORTUNITIES.map(opp => (
            <div key={opp.id} className="cc-opp-card">
              <div className="cc-opp-header">
                <h3 className="cc-opp-title">{opp.title}</h3>
                <span className="cc-opp-gap">{opp.gap}</span>
              </div>
              <p className="cc-opp-desc">{opp.desc}</p>
              <button 
                className="cc-opp-btn"
                onClick={() => handleSelectOpportunity(opp.segment)}
                disabled={discovering || launching}
              >
                Target Segment →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Hybrid Search & Discovery Bar */}
      <section className="cc-discovery-section">
        <h2 className="cc-section-title" style={{ color: 'var(--cc-accent-neon)' }}><BrainCircuit size={18} /> Semantic Discovery</h2>
        
        <div className="cc-search-wrapper">
          <Search className="cc-search-icon" size={24} />
          <input 
            type="text" 
            className="cc-search-input"
            placeholder="Describe your target audience naturally (e.g. 'Weekend impulse buyers...')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            disabled={discovering || launching || campaignActive}
          />
        </div>

        {discoverError && <div style={{ color: 'var(--error)' }}>Error: {discoverError}</div>}
        {launchError && <div style={{ color: 'var(--error)' }}>Error: {launchError}</div>}
        
        {discovering && <div style={{ color: 'var(--cc-accent-neon)', fontSize: '0.9rem' }}>Running Vector Search...</div>}

        {audienceLocked && !discovering && !campaignActive && (
          <>
            <div className="cc-results-meta">
              <span><Users size={14} style={{ display:'inline', marginRight:'4px', verticalAlign:'-2px' }}/> {audienceSize.toLocaleString()} matching profiles found</span>
              <button 
                className="cc-generate-btn"
                onClick={handleGenerateCampaign}
                disabled={launching}
              >
                {launching ? 'Generating...' : 'Generate Campaign'} <Zap size={16} style={{ display:'inline', marginLeft:'4px', verticalAlign:'-3px' }}/>
              </button>
            </div>

            {/* Twins Grid */}
            <div className="cc-twins-grid">
              {twins.map(twin => (
                <div key={twin.customerId} className="cc-twin-card">
                  <div className="cc-twin-header">
                    <span className="cc-twin-id">{twin.customerId.substring(0, 8)}</span>
                    <span>{twin.firstName}</span>
                  </div>
                  <div className="cc-twin-stats">
                    <span className="cc-twin-stat" title="Recency">R:{twin.rfm.recencyScore}</span>
                    <span className="cc-twin-stat" title="Frequency">F:{twin.rfm.frequencyScore}</span>
                    <span className="cc-twin-stat" title="Monetary">M:${twin.rfm.monetaryScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 3. Live Execution Dashboard */}
      {campaignActive && (
        <section className="cc-dashboard-section">
          <div className="cc-dash-header">
            <h2 className="cc-section-title" style={{ margin: 0, color: 'var(--cc-text-primary)' }}><Target size={18} /> Live Bandit Telemetry</h2>
            <div className={`cc-status-badge cc-status-${campaignStatus.toLowerCase()}`}>
              {campaignStatus === 'OPTIMIZING' || campaignStatus === 'EXECUTING' ? <Activity size={16} /> : <Zap size={16} />}
              {campaignStatus}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--cc-text-secondary)', fontWeight: 600 }}>
              <span>Exploration Phase (15%)</span>
              <span>{progressPct.toFixed(1)}% / 15.0%</span>
            </div>
            <div className="cc-progress-bar">
              <div className="cc-progress-marker"></div>
              <div className="cc-progress-fill" style={{ width: `${Math.min(progressPct, 100)}%` }}></div>
            </div>
          </div>

          <div className="cc-variant-grid">
            {variants.map(variant => (
              <div key={variant.id} className={`cc-variant-card ${variant.status.toLowerCase()}`}>
                <div className="cc-variant-header">
                  <span className="cc-variant-id">Variant {variant.id}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '3px 10px', borderRadius: '4px', background: 'var(--cc-bg-base)', color: 'var(--cc-text-primary)', border: '1px solid var(--cc-outline)' }}>
                    {variant.status}
                  </span>
                </div>
                
                <div className="cc-variant-copy">
                  {variant.copy}
                </div>

                <div className="cc-metrics-grid">
                  <div className="cc-metric">
                    <span className="cc-metric-label">Dispatches</span>
                    <span className="cc-metric-value">{variant.dispatches.toLocaleString()}</span>
                  </div>
                  <div className="cc-metric">
                    <span className="cc-metric-label">Live Clicks</span>
                    <span className="cc-metric-value" style={{ color: variant.status === 'WINNING' ? 'var(--cc-accent-success)' : 'inherit' }}>
                      {variant.clicks.toLocaleString()}
                      {(campaignStatus === 'OPTIMIZING' || campaignStatus === 'EXECUTING') && variant.status !== 'KILLED' && <div className="cc-live-dot" />}
                    </span>
                  </div>
                  <div className="cc-metric" style={{ gridColumn: 'span 2' }}>
                    <span className="cc-metric-label">CTR</span>
                    <span className="cc-metric-value" style={{ fontSize: '1.5rem', color: variant.status === 'WINNING' ? 'var(--cc-accent-success)' : 'var(--cc-text-primary)' }}>
                      {variant.ctr.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
