import React, { useState, useEffect } from 'react';
import { useCampaignStats } from '../hooks/useCampaignStats.ts';

const API_BASE = 'http://localhost:4000/api';

const STATUS_STYLES = {
  DRAFT:      { background: 'var(--surface-variant)',   color: 'var(--on-surface-variant)' },
  EXECUTING:  { background: 'rgba(245,158,11,0.15)',    color: '#d97706' },
  OPTIMIZING: { background: 'rgba(53,37,205,0.1)',      color: 'var(--primary)' },
  COMPLETED:  { background: 'rgba(16,185,129,0.15)',    color: '#059669' },
  FAILED:     { background: 'var(--error-container)',   color: 'var(--error)' },
};

const CHANNEL_COSTS = {
  EMAIL: 0.01,
  SMS: 0.05,
  WHATSAPP: 0.07,
};

function RoiEstimator({ stats, onToggleChannel }) {
  const { audienceSize, audienceAov, channels } = stats;
  
  // Baseline conversion assumption
  const EXPECTED_CONVERSION_RATE = 0.03; 
  
  // Formulas
  const estimatedRevenue = audienceSize * EXPECTED_CONVERSION_RATE * audienceAov;
  const cogs = estimatedRevenue * 0.40; // 40% COGS
  
  const variableCostPerUser = (channels || []).reduce((sum, ch) => sum + (CHANNEL_COSTS[ch] || 0), 0);
  const variableMarketingCosts = audienceSize * variableCostPerUser;
  
  const fixedAiOverhead = 5.00;
  
  const netIncome = estimatedRevenue - cogs - variableMarketingCosts - fixedAiOverhead;

  const formatMoney = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  return (
    <div className="card" style={{ padding: 'var(--spacing-lg)', background: 'linear-gradient(135deg, var(--surface-container-lowest), rgba(53,37,205,0.02))' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>monitoring</span>
        Campaign ROI & Channel Strategy
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Side: Channel Selector */}
        <div>
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: '12px' }}>Communication Channels</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { id: 'EMAIL', label: 'Email', cost: '$0.01/msg', recommended: true },
              { id: 'SMS', label: 'SMS Text', cost: '$0.05/msg' },
              { id: 'WHATSAPP', label: 'WhatsApp', cost: '$0.07/msg' },
            ].map(ch => {
              const isActive = (channels || []).includes(ch.id);
              return (
                <label key={ch.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: isActive ? '2px solid var(--primary)' : '1px solid var(--outline-variant)', borderRadius: 'var(--radius-md)', background: isActive ? 'rgba(53,37,205,0.05)' : 'var(--surface)', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input 
                      type="checkbox" 
                      checked={isActive} 
                      disabled={stats.status !== 'DRAFT'}
                      onChange={() => onToggleChannel(ch.id)} 
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {ch.label} 
                        {ch.recommended && <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.1)', color: '#059669', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Recommended</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>Cost: {ch.cost}</div>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Right Side: Projections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--surface)', padding: '16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--outline-variant)', paddingBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Segment AOV</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{formatMoney(audienceAov)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--on-surface-variant)', fontWeight: 600 }}>Est. Revenue (3% CR)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>{formatMoney(estimatedRevenue)}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--error)' }}>Cost of Goods Sold (40%)</span>
              <span style={{ fontWeight: 600 }}>-{formatMoney(cogs)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--error)' }}>Variable Channel Costs</span>
              <span style={{ fontWeight: 600 }}>-{formatMoney(variableMarketingCosts)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--error)' }}>Fixed AI Execution</span>
              <span style={{ fontWeight: 600 }}>-{formatMoney(fixedAiOverhead)}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '16px', borderTop: '2px dashed var(--outline-variant)' }}>
            <span style={{ fontSize: '1rem', fontWeight: 800 }}>Net Projected Income</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: netIncome >= 0 ? '#059669' : 'var(--error)' }}>{formatMoney(netIncome)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantCard({ variant, maxCtr, isActive, status, onSaveTemplate }) {
  const [editing, setEditing] = useState(false);
  const [draftTemplate, setDraftTemplate] = useState(variant.template);

  const barWidth = maxCtr > 0 ? (variant.ctr / maxCtr) * 100 : 0;

  return (
    <div style={{
      background: variant.isWinner ? 'linear-gradient(135deg, rgba(53,37,205,0.08), rgba(79,70,229,0.05))' : 'var(--surface)',
      border: variant.isWinner ? '2px solid var(--primary)' : '1px solid var(--outline-variant)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      transition: 'all 0.4s ease',
      transform: variant.isWinner ? 'translateY(-4px)' : 'none',
      boxShadow: variant.isWinner ? '0 8px 24px rgba(53,37,205,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--outline-variant)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: variant.isWinner ? 'rgba(53,37,205,0.05)' : 'var(--surface-container-lowest)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--on-surface)' }}>Variant {variant.variantId}</span>
          {variant.isWinner && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-full)', padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' }}>
              🏆 WINNER
            </span>
          )}
        </div>
        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: variant.isWinner ? 'var(--primary)' : 'var(--on-surface)' }}>
          {variant.ctr.toFixed(1)}%
          <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--on-surface-variant)', marginLeft: '2px' }}>CTR</span>
        </span>
      </div>

      {/* Live CTR bar */}
      <div style={{ height: '4px', background: 'var(--surface-variant)' }}>
        <div style={{
          height: '100%',
          width: `${barWidth}%`,
          background: variant.isWinner ? 'var(--primary)' : 'var(--secondary)',
          transition: isActive ? 'width 0.8s ease' : 'none',
          borderRadius: '0 2px 2px 0',
        }} />
      </div>

      {/* Template Copy */}
      <div style={{ padding: '16px', borderBottom: '1px solid var(--outline-variant)' }}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--on-surface-variant)', marginBottom: '8px', fontWeight: 600 }}>Message Copy</div>
        {status === 'DRAFT' && editing ? (
          <div>
            <textarea
              value={draftTemplate}
              onChange={e => setDraftTemplate(e.target.value)}
              style={{ width: '100%', minHeight: '80px', padding: '8px', borderRadius: '4px', border: '1px solid var(--primary)', background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', fontFamily: 'inherit', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setEditing(false); setDraftTemplate(variant.template); }} style={{ padding: '4px 8px', fontSize: '12px' }}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { onSaveTemplate(variant.variantId, draftTemplate); setEditing(false); }} style={{ padding: '4px 12px', fontSize: '12px' }}>Save</button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '0.875rem', lineHeight: '1.5', color: 'var(--on-surface)', whiteSpace: 'pre-wrap' }}>{variant.template || 'Loading template...'}</div>
            {status === 'DRAFT' && (
              <button className="btn btn-ghost" onClick={() => setEditing(true)} style={{ padding: '4px 8px', fontSize: '12px', marginTop: '8px' }}>✎ Edit</button>
            )}
          </div>
        )}
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '16px', gap: '8px' }}>
        {[
          { label: 'Sent', value: variant.sent.toLocaleString(), color: 'var(--on-surface)' },
          { label: 'Opens', value: variant.opens.toLocaleString(), sub: `${variant.openRate}%`, color: '#059669' },
          { label: 'Clicks', value: variant.clicks.toLocaleString(), sub: `${variant.ctr}%`, color: 'var(--primary)' },
        ].map(m => (
          <div key={m.label} style={{ textAlign: 'center', padding: '8px', background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 800, color: m.color, fontVariantNumeric: 'tabular-nums' }}>{m.value}</div>
            {m.sub && <div style={{ fontSize: '0.65rem', color: m.color, opacity: 0.8, fontWeight: 600 }}>{m.sub}</div>}
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-surface-variant)', marginTop: '2px' }}>{m.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useParams, useNavigate } from 'react-router-dom';

export default function CampaignDetail() {
  const { id: campaignId } = useParams();
  const navigate = useNavigate();
  const [launching, setLaunching] = useState(false);
  const [refinementPrompt, setRefinementPrompt] = useState('');
  const [targetVariant, setTargetVariant] = useState('ALL');
  const [refining, setRefining] = useState(false);

  const isActive = campaignId != null;
  const { stats, loading, error } = useCampaignStats(campaignId, isActive);

  const handleUpdateVariant = async (variantId, template) => {
    try {
      await fetch(`${API_BASE}/campaigns/${campaignId}/variants/${variantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefine = async () => {
    if (!refinementPrompt.trim()) return;
    try {
      setRefining(true);
      await fetch(`${API_BASE}/campaigns/${campaignId}/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refinementPrompt, targetVariant }),
      });
      setRefinementPrompt('');
    } catch (err) {
      console.error(err);
    } finally {
      setRefining(false);
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
    // Prevent deselecting all
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

  const handleLaunch = async () => {
    try {
      setLaunching(true);
      await fetch(`${API_BASE}/campaigns/${campaignId}/launch`, { method: 'POST' });
      // The polling hook will pick up the status change automatically
    } catch (err) {
      console.error(err);
    } finally {
      setLaunching(false);
    }
  };

  // Compute max CTR across variants for normalizing the bar widths
  const maxCtr = stats ? Math.max(...stats.variants.map(v => v.ctr), 0.001) : 0;

  const statusStyle = stats ? (STATUS_STYLES[stats.status] ?? STATUS_STYLES.DRAFT) : STATUS_STYLES.DRAFT;

  if (!campaignId) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: 'var(--on-surface-variant)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>campaign</span>
        <p>Select a campaign to view its live telemetry.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>

      {/* Back */}
      <button onClick={() => navigate('/campaigns')} className="btn btn-ghost" style={{ alignSelf: 'flex-start', padding: 0 }}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span> Back to Campaigns
      </button>

      {/* Error state */}
      {error && (
        <div style={{ background: 'var(--error-container)', color: 'var(--error)', padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          {[1, 2].map(i => <div key={i} style={{ height: '80px', background: 'var(--surface-variant)', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      )}

      {stats && (
        <>
          {/* ── Campaign Header ─────────────────────────────────────────────── */}
          <div className="card flex-row justify-between" style={{ flexWrap: 'wrap', gap: 'var(--spacing-md)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <h2 className="text-h2">
                  {stats.name}
                </h2>
                <span className="badge" style={statusStyle}>{stats.status}</span>
                {/* Live pulse when executing */}
                {stats.status === 'EXECUTING' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#d97706', fontWeight: 600 }}>
                    <span style={{ width: '8px', height: '8px', background: '#d97706', borderRadius: '50%', animation: 'pulse-dot 1s ease-in-out infinite', display: 'inline-block' }} />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-body-sm">
                {stats.processed.toLocaleString()} / {stats.audienceSize.toLocaleString()} dispatched
                {stats.failed > 0 && <span style={{ color: 'var(--error)', marginLeft: '12px' }}>· {stats.failed} failed</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={async () => {
                  try {
                    await fetch(`${API_BASE}/campaigns/${id}/toggle-save`, { method: 'POST' });
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: stats.isSaved ? "'FILL' 1" : "'FILL' 0", color: stats.isSaved ? 'var(--primary)' : 'inherit' }}>
                  bookmark
                </span>
                {stats.isSaved ? 'Saved' : 'Save Template'}
              </button>
              {stats.status === 'DRAFT' && (
                <button className="btn btn-primary" onClick={handleLaunch} disabled={launching}>
                  <span className="material-symbols-outlined">rocket_launch</span>
                  {launching ? 'Launching...' : 'Launch Campaign'}
                </button>
              )}
            </div>
          </div>

          {/* ── Progress Bar ────────────────────────────────────────────────── */}
          <div className="card" style={{ padding: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Delivery Progress</span>
              <span className="text-body-sm">{stats.progressPct}%</span>
            </div>
            <div style={{ height: '10px', background: 'var(--surface-variant)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${stats.progressPct}%`,
                background: stats.status === 'COMPLETED' ? '#059669' : stats.status === 'FAILED' ? 'var(--error)' : 'var(--primary)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.8s ease',
              }} />
            </div>
            {/* Exploration phase marker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <span className="text-caption">
                {stats.explorationComplete
                  ? `✅ Exploration complete — Winner: Variant ${stats.winnerVariant ?? '—'}`
                  : '🔬 Exploration phase (15% batch sampling)'}
              </span>
              <span className="text-caption">{stats.audienceSize.toLocaleString()} total</span>
            </div>
          </div>

          <RoiEstimator stats={stats} onToggleChannel={handleToggleChannel} />

          {/* ── Winner Banner ────────────────────────────────────────────────── */}
          {stats.explorationComplete && stats.winnerVariant && (
            <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-container))', borderRadius: 'var(--radius-lg)', padding: 'var(--spacing-md) var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Bandit Algorithm Selected</div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '1.5rem' }}>🏆 Variant {stats.winnerVariant} wins</div>
                <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', marginTop: '2px' }}>
                  Remaining {(stats.audienceSize - stats.processed).toLocaleString()} messages routing to the winner
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem', marginBottom: '4px' }}>Winning CTR</div>
                <div style={{ color: 'white', fontWeight: 800, fontSize: '2rem' }}>
                  {stats.variants.find(v => v.variantId === stats.winnerVariant)?.ctr.toFixed(1) ?? '—'}%
                </div>
              </div>
            </div>
          )}

          {/* ── Refine AI Copy (DRAFT ONLY) ──────────────────────────────────── */}
          {stats.status === 'DRAFT' && (
            <div className="card" style={{ padding: 'var(--spacing-md)', background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(79,70,229,0.1))', border: '1px solid var(--primary-container)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--primary)', fontWeight: 600 }}>
                <span className="material-symbols-outlined">temp_preferences_custom</span> Refine AI Copy
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: '12px' }}>
                Not happy with the drafts? Tell the AI how to adjust them (e.g. "make them funnier" or "add emojis") and it will rewrite all three variants.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select
                  value={targetVariant}
                  onChange={e => setTargetVariant(e.target.value)}
                  className="cc-input"
                  style={{ background: 'var(--surface)', cursor: 'pointer', maxWidth: '150px' }}
                >
                  <option value="ALL">All Variants</option>
                  <option value="A">Variant A</option>
                  <option value="B">Variant B</option>
                  <option value="C">Variant C</option>
                </select>
                <input 
                  type="text" 
                  className="cc-input" 
                  style={{ flex: 1, background: 'var(--surface)' }}
                  placeholder="e.g., Make them sound more urgent and use emojis"
                  value={refinementPrompt}
                  onChange={e => setRefinementPrompt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefine()}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleRefine}
                  disabled={refining || !refinementPrompt.trim()}
                >
                  {refining ? 'Refining...' : 'Regenerate'}
                </button>
              </div>
            </div>
          )}

          {/* ── Variant Telemetry Cards ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-lg)' }}>
            {stats.variants.map(v => (
              <VariantCard
                key={v.variantId}
                variant={v}
                maxCtr={maxCtr}
                isActive={stats.status === 'EXECUTING' || stats.status === 'OPTIMIZING'}
                status={stats.status}
                onSaveTemplate={handleUpdateVariant}
              />
            ))}
          </div>
        </>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
