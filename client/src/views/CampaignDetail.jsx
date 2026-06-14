import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useCampaignStats } from '../hooks/useCampaignStats.ts';
import './CampaignDetail.css';

const API_BASE = 'http://localhost:4000/api';

const CHANNEL_COSTS = {
  EMAIL: 0.01,
  SMS: 0.05,
  WHATSAPP: 0.07,
};

function RoiEstimator({ stats, discountPct = 0, applyDiscountToRoi = false }) {
  const { audienceSize, audienceAov, channels } = stats;
  
  // Baseline conversion assumption
  const EXPECTED_CONVERSION_RATE = 0.03; 
  
  // Formulas
  let estimatedRevenue = audienceSize * EXPECTED_CONVERSION_RATE * audienceAov;
  if (applyDiscountToRoi && discountPct > 0) {
    estimatedRevenue = estimatedRevenue * (1 - (discountPct / 100));
  }
  const cogs = estimatedRevenue * 0.40; // 40% COGS
  
  const variableCostPerUser = (channels || []).reduce((sum, ch) => sum + (CHANNEL_COSTS[ch] || 0), 0);
  const variableMarketingCosts = audienceSize * variableCostPerUser;
  
  const fixedAiOverhead = 5.00;
  
  const netIncome = estimatedRevenue - cogs - variableMarketingCosts - fixedAiOverhead;

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div className="roi-estimator">
      <div className="roi-header">
        <h3 className="roi-title">ROI Estimator</h3>
        <span className="material-symbols-outlined text-secondary">analytics</span>
      </div>
      
      <div className="roi-list">
        <div className="roi-item">
          <span>Estimated Revenue</span>
          <span className="roi-value">{formatMoney(estimatedRevenue)}</span>
        </div>
        <div className="roi-item">
          <span>COGS (Direct)</span>
          <span className="roi-value" style={{ color: 'var(--error)' }}>({formatMoney(cogs)})</span>
        </div>
        <div className="roi-item bordered">
          <span>Channel Costs</span>
          <span className="roi-value" style={{ color: 'var(--error)' }}>({formatMoney(variableMarketingCosts + fixedAiOverhead)})</span>
        </div>
      </div>
      
      <div className="roi-net">
        <span className="roi-net-label">Net Projected Income</span>
        <span className="roi-net-value" style={{ color: netIncome >= 0 ? 'var(--primary)' : 'var(--error)' }}>{formatMoney(netIncome)}</span>
      </div>
    </div>
  );
}

function CampaignAnalytics({ stats }) {
  const totalSent = stats.processed || 0;
  const totalFailed = stats.failed || 0;
  const totalOpens = (stats.variants || []).reduce((sum, v) => sum + (v.opens || 0), 0);
  const totalClicks = (stats.variants || []).reduce((sum, v) => sum + (v.clicks || 0), 0);
  const avgCtr = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : '0.0';

  return (
    <div className="roi-estimator" style={{ marginTop: '24px' }}>
      <div className="roi-header">
        <h3 className="roi-title">Live Analytics</h3>
        <span className="material-symbols-outlined text-secondary">monitoring</span>
      </div>
      
      <div className="roi-list">
        <div className="roi-item">
          <span>Total Processed</span>
          <span className="roi-value">{totalSent.toLocaleString()}</span>
        </div>
        <div className="roi-item">
          <span>Failed Deliveries</span>
          <span className="roi-value" style={{ color: totalFailed > 0 ? 'var(--error)' : 'var(--on-surface-variant)' }}>{totalFailed.toLocaleString()}</span>
        </div>
        <div className="roi-item">
          <span>Total Opens</span>
          <span className="roi-value" style={{ color: 'var(--primary)' }}>{totalOpens.toLocaleString()}</span>
        </div>
        <div className="roi-item bordered">
          <span>Total Clicks (Overall CTR)</span>
          <span className="roi-value" style={{ color: 'var(--sienna)' }}>{totalClicks.toLocaleString()} ({avgCtr}%)</span>
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, maxCtr, status, index, campaignId, fetchStats }) {
  const letters = ['A', 'B', 'C', 'D'];
  const letter = letters[index % letters.length];
  
  const sentPct = variant.sent > 0 ? 100 : 0;
  const opensPct = variant.openRate || 0;
  const clicksPct = variant.ctr || 0;

  const [isRefining, setIsRefining] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');
  const [refiningLoading, setRefiningLoading] = useState(false);

  const handleRefine = async () => {
    if (!refinePrompt.trim() || refiningLoading) return;
    try {
      setRefiningLoading(true);
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVariant: variant.variantId,
          refinementPrompt: refinePrompt
        })
      });
      if (res.ok) {
        setRefinePrompt('');
        setIsRefining(false);
        if (fetchStats) await fetchStats();
      } else {
        const data = await res.json();
        console.error('Refine failed:', data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefiningLoading(false);
    }
  };

  return (
    <div className={`variant-card-container ai-gradient-border ${variant.isWinner ? 'winner' : ''}`}>
      {variant.isWinner && (
        <div className="winner-badge">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>emoji_events</span>
          Winning Variant
        </div>
      )}
      
      <div className="variant-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="variant-card-title-group">
          <span className="variant-letter" style={{ backgroundColor: variant.isWinner ? 'var(--primary)' : 'var(--primary-container)', color: 'white' }}>{letter}</span>
          <h4 className="variant-title">Variant {variant.variantId}</h4>
        </div>
        {status === 'DRAFT' && (
          <button 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '14px', borderColor: 'var(--sienna)', color: 'var(--sienna)' }}
            onClick={() => setIsRefining(!isRefining)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '4px' }}>auto_awesome</span>
            Refine
          </button>
        )}
      </div>
      
      <p className="variant-copy">"{variant.template}"</p>

      {isRefining && (
        <div className="refine-box" style={{ marginTop: '16px', backgroundColor: 'var(--surface-container-lowest)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(196, 199, 202, 0.2)' }}>
          <label className="form-label" style={{ color: 'var(--sienna)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit_note</span>
            AI Refinement Prompt
          </label>
          <textarea 
            className="form-input-box form-textarea" 
            placeholder="E.g., Make it sound more urgent, or highlight the free shipping..."
            value={refinePrompt}
            onChange={(e) => setRefinePrompt(e.target.value)}
            disabled={refiningLoading}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button className="btn-secondary" onClick={() => setIsRefining(false)} disabled={refiningLoading}>Cancel</button>
            <button className="btn-primary" style={{ backgroundColor: 'var(--sienna)' }} onClick={handleRefine} disabled={refiningLoading || !refinePrompt.trim()}>
              {refiningLoading ? 'Refining...' : 'Apply Changes'}
            </button>
          </div>
        </div>
      )}
      
      <div className="variant-metrics">
        <div className="metric-col">
          <div className="metric-row">
            <span style={{ color: 'var(--outline)' }}>Sent</span>
            <span className="metric-val">{variant.sent.toLocaleString()}</span>
          </div>
          <div className="metric-bar-bg">
            <div className="metric-bar-fill" style={{ width: `${sentPct}%`, backgroundColor: 'var(--primary)' }}></div>
          </div>
        </div>
        
        <div className="metric-col">
          <div className="metric-row">
            <span style={{ color: 'var(--outline)' }}>Opens</span>
            <span className="metric-val">{variant.opens.toLocaleString()}</span>
          </div>
          <div className="metric-bar-bg">
            <div className="metric-bar-fill" style={{ width: `${opensPct}%`, backgroundColor: 'var(--secondary-container)' }}></div>
          </div>
        </div>
        
        <div className="metric-col">
          <div className="metric-row">
            <span style={{ color: 'var(--outline)' }}>Clicks</span>
            <span className="metric-val">{variant.ctr.toFixed(1)}%</span>
          </div>
          <div className="metric-bar-bg">
            <div className="metric-bar-fill" style={{ width: `${Math.min(clicksPct * 10, 100)}%`, backgroundColor: 'var(--sienna)' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const { panes, togglePane, expandPane, startResizing, isDragging } = useOutletContext();
  
  const [launching, setLaunching] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [discountPct, setDiscountPct] = useState('');
  const [applyDiscount, setApplyDiscount] = useState(true);
  
  // Campaign Details Hook
  const isActive = campaignId != null;
  const { stats, loading, error, fetchStats } = useCampaignStats(campaignId, isActive);

  const handleLaunch = async () => {
    try {
      setLaunching(true);
      await fetch(`${API_BASE}/campaigns/${campaignId}/launch`, { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setLaunching(false);
    }
  };

  const [localChannels, setLocalChannels] = useState([]);

  useEffect(() => {
    if (stats?.channels) {
      setLocalChannels(stats.channels);
    }
  }, [stats?.channels]);

  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateVariants = async () => {
    if (isRegenerating) return;
    let prompt = "Update the copy to include our latest offer.";
    if (couponCode && discountPct) {
      prompt = `Update the copy to prominently feature the coupon code '${couponCode}' which gives a ${discountPct}% discount. Make it sound exciting!`;
    } else if (couponCode) {
      prompt = `Update the copy to include the coupon code '${couponCode}'.`;
    } else if (discountPct) {
      prompt = `Update the copy to include a ${discountPct}% discount offer.`;
    }

    try {
      setIsRegenerating(true);
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetVariant: 'ALL',
          refinementPrompt: prompt
        })
      });
      if (res.ok) {
        if (fetchStats) await fetchStats();
      } else {
        const data = await res.json();
        console.error('Regenerate failed:', data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleToggleChannel = async (channelId) => {
    if (!stats || stats.status !== 'DRAFT') return;
    const currentChannels = localChannels.length ? localChannels : (stats.channels || []);
    let newChannels = [];
    if (currentChannels.includes(channelId)) {
      newChannels = currentChannels.filter(c => c !== channelId);
    } else {
      newChannels = [...currentChannels, channelId];
    }
    if (newChannels.length === 0) return;

    // Optimistic update
    setLocalChannels(newChannels);

    try {
      await fetch(`${API_BASE}/campaigns/${campaignId}/channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: newChannels }),
      });
      if (fetchStats) fetchStats();
    } catch (err) {
      console.error(err);
      // Revert on failure
      setLocalChannels(currentChannels);
    }
  };

  const maxCtr = stats ? Math.max(...stats.variants.map(v => v.ctr), 0.001) : 0;
  const isExecuting = stats?.status === 'EXECUTING' || stats?.status === 'OPTIMIZING';

  return (
    <>
      {/* 3. Middle Pane: Setup / ROI Config */}
      <div 
        className={`workspace-pane pane-middle ${panes.middle ? 'open' : 'closed'}`}
        onClick={() => expandPane('middle')}
      >
        {panes.middle ? (
          <div className="pane-header-strip">
            <button className="pane-toggle-btn" onClick={(e) => { e.stopPropagation(); togglePane('middle'); }}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          </div>
        ) : (
          <span className="material-symbols-outlined collapsed-vertical-icon">settings</span>
        )}
        <div className="pane-content middle-pane-content custom-scrollbar">
          <div className="pane-inner-padding">
            {!campaignId ? (
              <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--on-surface-variant)' }}>
                <p>Select a campaign to view.</p>
              </div>
            ) : loading && !stats ? (
              <div style={{ padding: '100px 0', textAlign: 'center' }}>Loading campaign details...</div>
            ) : error ? (
              <div style={{ padding: '100px 0', color: 'var(--error)' }}>Error: {error}</div>
            ) : (
              <>
                <header className="studio-header" style={{ marginBottom: '16px' }}>
                  <h1 className="studio-title">{stats?.name || 'Campaign Studio'}</h1>
                  <p className="studio-subtitle">Configure your value proposition and baseline economics.</p>
                </header>
                
                {/* Offer Setup Form */}
                <div className="offer-setup-form" style={{ gap: '8px', marginBottom: '24px' }}>
                  <div className="form-row" style={{ margin: 0 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ marginBottom: '2px' }}>Coupon Code</label>
                      <input 
                        type="text" 
                        className="form-input-box" 
                        placeholder="e.g. SUMMER25"
                        value={couponCode} 
                        onChange={(e) => setCouponCode(e.target.value)} 
                        disabled={stats?.status !== 'DRAFT'}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ marginBottom: '2px' }}>Discount %</label>
                      <input 
                        type="number" 
                        className="form-input-box" 
                        placeholder="25"
                        value={discountPct} 
                        onChange={(e) => setDiscountPct(Number(e.target.value))}
                        disabled={stats?.status !== 'DRAFT'}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '16px', margin: 0, padding: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="apply-discount-toggle"
                        checked={applyDiscount}
                        onChange={(e) => setApplyDiscount(e.target.checked)}
                        style={{ accentColor: 'var(--sienna)', width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                      />
                      <label htmlFor="apply-discount-toggle" className="form-label" style={{ cursor: 'pointer', margin: 0, textTransform: 'none', color: 'var(--on-surface-variant)' }}>
                        Apply discount to ROI estimated revenue
                      </label>
                    </div>

                    {stats?.status === 'DRAFT' && (
                      <button 
                        className="btn-secondary" 
                        onClick={handleRegenerateVariants}
                        disabled={isRegenerating || (!couponCode && !discountPct)}
                        style={{ borderColor: 'var(--sienna)', color: 'var(--sienna)', padding: '6px 12px', fontSize: '12px' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px', marginRight: '4px' }}>auto_awesome</span>
                        {isRegenerating ? 'Refining...' : 'Regenerate Variants'}
                      </button>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Channel Distribution</label>
                    <div className="channel-distribution">
                      {['EMAIL', 'SMS', 'WHATSAPP'].map(ch => {
                        const activeList = localChannels.length ? localChannels : (stats?.channels || []);
                        const isActiveChannel = activeList.includes(ch);
                        return (
                          <button 
                            key={ch}
                            className={`channel-btn ${isActiveChannel ? 'active' : ''}`}
                            onClick={() => handleToggleChannel(ch)}
                            disabled={stats?.status !== 'DRAFT'}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            {isActiveChannel && <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>auto_awesome</span>}
                            {ch}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {stats && <RoiEstimator stats={{...stats, channels: localChannels.length ? localChannels : stats.channels}} discountPct={discountPct} applyDiscountToRoi={applyDiscount} />}
                
                {stats && <CampaignAnalytics stats={stats} />}

                {stats?.status === 'DRAFT' && (
                  <div className="actions-row">
                    <button className="btn-secondary" onClick={() => navigate('/campaigns')}>Cancel</button>
                    <button className="btn-primary" onClick={handleLaunch} disabled={launching}>
                      {launching ? 'Launching...' : 'Launch Campaign'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 4. Resizer 2 (Middle-Right) */}
      <div 
        className={`pane-resizer ${isDragging === 'middle' ? 'active' : ''}`}
        onMouseDown={panes.middle && panes.right ? (e) => startResizing('middle', e) : undefined}
      ></div>

      {/* 5. Right Pane: Variant Testing Grid */}
      <div 
        className={`workspace-pane pane-right ${panes.right ? 'open' : 'closed'}`}
        onClick={() => expandPane('right')}
      >
        {panes.right ? (
          <div className="pane-header-strip">
            <button className="pane-toggle-btn" onClick={(e) => { e.stopPropagation(); togglePane('right'); }}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        ) : (
          <span className="material-symbols-outlined collapsed-vertical-icon">science</span>
        )}
        <div className="pane-content right-pane-content custom-scrollbar">
          <div className="pane-inner-padding">
            {stats ? (
              <>
                <div className="variants-header">
                  <h2 className="variants-title">Variant Testing Grid</h2>
                  <div className="live-badge">
                    <div className="live-dot" style={{ display: isExecuting ? 'block' : 'none' }}></div>
                    {isExecuting ? 'Live Multi-Armed Bandit' : (stats?.status === 'COMPLETED' ? 'Campaign Completed' : 'Waiting to Launch')}
                  </div>
                </div>

                <div className="variants-list">
                  {stats?.variants.map((v, i) => (
                    <VariantCard
                      key={v.variantId}
                      variant={v}
                      maxCtr={maxCtr}
                      status={stats?.status}
                      index={i}
                      campaignId={campaignId}
                      fetchStats={fetchStats}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: '100px 0', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                Select a campaign to view its variants.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
