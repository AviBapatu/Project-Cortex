import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

function VariantCard({ variant, maxCtr, status, index }) {
  const letters = ['A', 'B', 'C', 'D'];
  const letter = letters[index % letters.length];
  
  const sentPct = maxCtr > 0 ? 100 : 0; // Simplified for UI
  const opensPct = variant.openRate || 0;
  const clicksPct = variant.ctr || 0;

  return (
    <div className={`variant-card-container ai-gradient-border ${variant.isWinner ? 'winner' : ''}`}>
      {variant.isWinner && (
        <div className="winner-badge">
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>emoji_events</span>
          Winning Variant
        </div>
      )}
      
      <div className="variant-card-header">
        <div className="variant-card-title-group">
          <span className="variant-letter" style={{ backgroundColor: variant.isWinner ? 'var(--primary)' : 'var(--primary-container)', color: 'white' }}>{letter}</span>
          <h4 className="variant-title">Variant {variant.variantId}</h4>
        </div>
        <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>sparkles</span>
      </div>
      
      <p className="variant-copy">"{variant.template}"</p>
      
      <div className="variant-metrics">
        <div className="metric-col">
          <div className="metric-row">
            <span style={{ color: 'var(--outline)' }}>Sent</span>
            <span className="metric-val">{variant.sent.toLocaleString()}</span>
          </div>
          <div className="metric-bar-bg">
            <div className="metric-bar-fill" style={{ width: `100%`, backgroundColor: 'var(--primary)' }}></div>
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
  const [launching, setLaunching] = useState(false);
  const [couponCode, setCouponCode] = useState('SPRING24_PROMO');
  const [discountPct, setDiscountPct] = useState(25);
  
  const isActive = campaignId != null;
  const { stats, loading, error } = useCampaignStats(campaignId, isActive);

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

  const handleToggleChannel = async (channelId) => {
    if (!stats || stats.status !== 'DRAFT') return;
    const currentChannels = stats.channels || [];
    let newChannels = [];
    if (currentChannels.includes(channelId)) {
      newChannels = currentChannels.filter(c => c !== channelId);
    } else {
      newChannels = [...currentChannels, channelId];
    }
    if (newChannels.length === 0) return;

    try {
      await fetch(`${API_BASE}/campaigns/${campaignId}/channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels: newChannels }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (!campaignId) {
    return (
      <div style={{ textAlign: 'center', padding: '100px', color: 'var(--on-surface-variant)' }}>
        <p>Select a campaign to view.</p>
      </div>
    );
  }

  if (loading && !stats) {
    return <div style={{ padding: '100px', textAlign: 'center' }}>Loading campaign details...</div>;
  }

  if (error) {
    return <div style={{ padding: '100px', color: 'var(--error)' }}>Error: {error}</div>;
  }

  const maxCtr = stats ? Math.max(...stats.variants.map(v => v.ctr), 0.001) : 0;
  const isExecuting = stats?.status === 'EXECUTING' || stats?.status === 'OPTIMIZING';

  return (
    <div className="campaign-detail-container">
      {/* Left Panel: Campaign Studio (40%) */}
      <section className="campaign-studio-left custom-scrollbar">
        <header className="studio-header">
          <h1 className="studio-title">{stats?.name || 'Campaign Studio'}</h1>
          <p className="studio-subtitle">Configure your value proposition and baseline economics.</p>
        </header>
        
        {/* Offer Setup Form */}
        <div className="offer-setup-form">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Coupon Code</label>
              <input 
                type="text" 
                className="form-input-box" 
                value={couponCode} 
                onChange={(e) => setCouponCode(e.target.value)} 
                disabled={stats?.status !== 'DRAFT'}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Discount %</label>
              <input 
                type="number" 
                className="form-input-box" 
                value={discountPct} 
                onChange={(e) => setDiscountPct(Number(e.target.value))}
                disabled={stats?.status !== 'DRAFT'}
              />
            </div>
          </div>
          
          <div className="form-group">
            <label className="form-label">Channel Distribution</label>
            <div className="channel-distribution">
              {['EMAIL', 'SMS', 'WHATSAPP'].map(ch => {
                const isActiveChannel = (stats?.channels || []).includes(ch);
                return (
                  <button 
                    key={ch}
                    className={`channel-btn ${isActiveChannel ? 'active' : ''}`}
                    onClick={() => handleToggleChannel(ch)}
                    disabled={stats?.status !== 'DRAFT'}
                  >
                    {ch}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {stats && <RoiEstimator stats={stats} discountPct={discountPct} applyDiscountToRoi={true} />}

        {stats?.status === 'DRAFT' && (
          <div className="actions-row">
            <button className="btn-secondary" onClick={() => navigate('/campaigns')}>Cancel</button>
            <button className="btn-primary" onClick={handleLaunch} disabled={launching}>
              {launching ? 'Launching...' : 'Launch Campaign'}
            </button>
          </div>
        )}
      </section>

      {/* Right Panel: Variant Testing Grid (60%) */}
      <section className="campaign-variants-right custom-scrollbar">
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
            />
          ))}
        </div>
      </section>
    </div>
  );
}
