import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Search, Activity, Target, Zap, Users, BrainCircuit } from 'lucide-react';
import { useDiscovery } from '../hooks/useDiscovery';
import { useLaunch } from '../hooks/useLaunch';
import { useCampaignStats } from '../hooks/useCampaignStats';
import './CommandCenter.css';
import { useOpportunities } from '../hooks/useOpportunities';

export default function CommandCenter() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 8;
  
  // Real Hooks
  const { opportunities, loading: oppsLoading, error: oppsError, fetchOpportunities } = useOpportunities();
  const { discover, loading: discovering, error: discoverError, results: discoveryResults } = useDiscovery();
  const { launch, launching, error: launchError, launchedId } = useLaunch();
  const { stats, loading: statsLoading } = useCampaignStats(launchedId, !!launchedId);

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

  // Handle clicking an opportunity
  const handleSelectOpportunity = (segment) => {
    setQuery(segment);
    discover(segment);
  };

  const handleSearch = () => {
    if (query.trim()) {
      setCurrentPage(0); // Reset page on new search
      discover(query);
    }
  };

  const handleGenerateCampaign = async () => {
    if (!discoveryResults || !campaignGoal) return;
    const draftId = await launch({
      name: `Campaign: ${query.substring(0, 20)}...`,
      goal: campaignGoal,
      segmentDescription: query.trim(),
      queryBreakdown: discoveryResults.queryBreakdown
    });
    
    if (draftId) {
      navigate(`/campaigns/${draftId}`);
    }
  };

  // Determine what to show in the discovery section
  const audienceLocked = !!discoveryResults;
  const audienceSize = discoveryResults?.audienceSize || 0;
  const allTwins = discoveryResults?.audienceSample || [];
  const queryBreakdown = discoveryResults?.queryBreakdown;
  
  // Pagination logic
  const totalPages = Math.ceil(allTwins.length / PAGE_SIZE);
  const twins = allTwins.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

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
      
      {/* 1. Hybrid Search & Discovery Bar */}
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
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Campaign Goal (e.g., Summer sale, clear inventory)"
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                  className="cc-search-input"
                  style={{ padding: '8px', flex: 1 }}
                  disabled={discovering || launching}
                />
                <button 
                  className="cc-generate-btn"
                  onClick={handleGenerateCampaign}
                  disabled={launching}
                >
                  {launching ? 'Generating...' : 'Generate Campaign'} <Zap size={16} style={{ display:'inline', marginLeft:'4px', verticalAlign:'-3px' }}/>
                </button>
              </div>
            </div>

            {queryBreakdown && (
              <div className={`cc-xai-banner ${queryBreakdown.usedSemanticSearch ? 'semantic' : 'deterministic'}`}>
                <strong>{queryBreakdown.usedSemanticSearch ? 'Semantic Search Active' : 'Deterministic Search'}: </strong>
                {queryBreakdown.reasoning}
              </div>
            )}

            {/* Twins Grid */}
            <div className="cc-twins-grid">
              {twins.map(twin => (
                <div key={twin.customerId} className="cc-twin-card">
                  <div className="cc-twin-header">
                    <span className="cc-twin-id">{twin.customerId.substring(0, 8)}</span>
                    <div className="cc-twin-header-right">
                      {twin.searchScore && (
                        <span className="cc-match-score">
                          {Math.round(twin.searchScore * 100)}% Match
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="cc-twin-name">{twin.firstName} {twin.lastName}</div>
                  
                  <div className="cc-twin-summary">
                    {twin.digitalTwinSummary}
                  </div>

                  <div className="cc-twin-stats">
                    <span className="cc-twin-stat" title="Recency">R:{twin.rfm.recencyScore}</span>
                    <span className="cc-twin-stat" title="Frequency">F:{twin.rfm.frequencyScore}</span>
                    <span className="cc-twin-stat" title="Monetary">M:${twin.rfm.monetaryScore}</span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="cc-pagination">
                <button 
                  disabled={currentPage === 0} 
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="cc-page-btn"
                >
                  ← Previous
                </button>
                <span className="cc-page-info">Page {currentPage + 1} of {totalPages}</span>
                <button 
                  disabled={currentPage === totalPages - 1} 
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="cc-page-btn"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* 2. Opportunity Engine */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="cc-section-title" style={{ margin: 0 }}><Sparkles size={18} /> Opportunity Engine</h2>
          <button 
            className="cc-opp-btn" 
            onClick={handleRunEngine} 
            disabled={runningEngine}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            {runningEngine ? 'Scanning...' : 'Run Engine Now'}
          </button>
        </div>
        {oppsLoading ? (
          <div style={{ color: 'var(--cc-text-secondary)', padding: '24px 0' }}>Loading opportunities...</div>
        ) : oppsError ? (
          <div style={{ color: 'var(--cc-accent-error)', padding: '24px 0' }}>Failed to load opportunities: {oppsError}</div>
        ) : opportunities.length === 0 ? (
          <div style={{ color: 'var(--cc-text-secondary)', padding: '24px 0' }}>No active opportunities right now. The AI is scanning...</div>
        ) : (
          <div className="cc-opp-grid">
            {opportunities.slice(0, 10).map(opp => (
              <div key={opp._id} className="cc-opp-card">
                <div className="cc-opp-header">
                  <h3 className="cc-opp-title">{opp.llmTitle}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="cc-opp-gap">{opp.audienceMatchCount} matches</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleToggleSaveOpp(opp._id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: opp.isSaved ? 'var(--cc-primary)' : 'var(--cc-text-secondary)', padding: 0, display: 'flex', alignItems: 'center' }}
                      title={opp.isSaved ? "Unsave" : "Save Opportunity"}
                    >
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: opp.isSaved ? "'FILL' 1" : "'FILL' 0", fontSize: '20px' }}>
                        bookmark
                      </span>
                    </button>
                  </div>
                </div>
                <p className="cc-opp-desc">{opp.llmDescription}</p>
                <button 
                  className="cc-opp-btn"
                  onClick={() => handleSelectOpportunity(opp.llmDescription)}
                  disabled={discovering || launching}
                >
                  Target Segment →
                </button>
              </div>
            ))}
          </div>
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
