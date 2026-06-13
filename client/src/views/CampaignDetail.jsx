import React, { useState } from 'react';
import { useCampaignStats } from '../hooks/useCampaignStats.ts';

const API_BASE = 'http://localhost:4000/api';

const STATUS_STYLES = {
  DRAFT:      { background: 'var(--surface-variant)',   color: 'var(--on-surface-variant)' },
  EXECUTING:  { background: 'rgba(245,158,11,0.15)',    color: '#d97706' },
  OPTIMIZING: { background: 'rgba(53,37,205,0.1)',      color: 'var(--primary)' },
  COMPLETED:  { background: 'rgba(16,185,129,0.15)',    color: '#059669' },
  FAILED:     { background: 'var(--error-container)',   color: 'var(--error)' },
};

function VariantCard({ variant, maxCtr, isActive }) {
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

  const isActive = campaignId != null;
  const { stats, loading, error } = useCampaignStats(campaignId, isActive);

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
                <h2 className="text-h2">{stats.name}</h2>
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
            {stats.status === 'DRAFT' && (
              <button className="btn btn-primary" onClick={handleLaunch} disabled={launching}>
                <span className="material-symbols-outlined">rocket_launch</span>
                {launching ? 'Launching...' : 'Launch Campaign'}
              </button>
            )}
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

          {/* ── Variant Telemetry Cards ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--spacing-lg)' }}>
            {stats.variants.map(v => (
              <VariantCard
                key={v.variantId}
                variant={v}
                maxCtr={maxCtr}
                isActive={stats.status === 'EXECUTING' || stats.status === 'OPTIMIZING'}
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
