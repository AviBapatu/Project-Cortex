import React, { useEffect, useState } from 'react';

const API_BASE = 'http://localhost:4000/api';

function ShopperDetailModal({ customerId, onClose }) {
  const [shopper, setShopper] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/shoppers/${customerId}`)
      .then(r => r.json())
      .then(d => { setShopper(d.shopper); setLoading(false); })
      .catch(() => setLoading(false));
  }, [customerId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="text-h3">Shopper Profile</h3>
          <button onClick={onClose} className="btn-ghost"><span className="material-symbols-outlined">close</span></button>
        </div>
        {loading && <p className="text-body-sm">Loading...</p>}
        {!loading && !shopper && <p className="text-body-sm" style={{ color: 'var(--error)' }}>Shopper not found.</p>}
        {shopper && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md)', background: 'var(--surface-variant)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-primary)', fontWeight: 'bold', fontSize: '1.5rem' }}>
                {shopper.firstName?.[0] ?? '?'}
              </div>
              <div>
                <div className="text-h3">{shopper.firstName} {shopper.lastName}</div>
                <div className="text-body-sm">{shopper.customerId}</div>
                <span className={`badge ${shopper.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`} style={{ marginTop: '4px' }}>{shopper.status}</span>
              </div>
            </div>
            {/* RFM */}
            <div>
              <div className="text-caption" style={{ marginBottom: '8px' }}>RFM Scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--spacing-sm)' }}>
                {['recency', 'frequency', 'monetary'].map(key => (
                  <div key={key} className="card" style={{ textAlign: 'center', padding: 'var(--spacing-md)' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>{shopper.rfm?.[key] ?? '—'}</div>
                    <div className="text-caption">{key.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* LTV */}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-body">Lifetime Value</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--primary)' }}>${(shopper.rfm?.totalLifetimeValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {/* Digital Twin */}
            {shopper.ai?.digitalTwinSummary && (
              <div>
                <div className="text-caption" style={{ marginBottom: '8px' }}>AI Digital Twin Summary</div>
                <div style={{ padding: 'var(--spacing-md)', background: 'var(--surface-variant)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--on-surface)', fontStyle: 'italic', lineHeight: 1.6 }}>
                  "{shopper.ai.digitalTwinSummary}"
                </div>
              </div>
            )}
            {/* Interests */}
            {shopper.ai?.inferredInterests?.length > 0 && (
              <div>
                <div className="text-caption" style={{ marginBottom: '8px' }}>Inferred Interests</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                  {shopper.ai.inferredInterests.map(interest => (
                    <span key={interest} className="badge badge-info">{interest}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Shoppers() {
  const [shoppers, setShoppers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [loading, setLoading] = useState(true);

  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter) params.set('status', statusFilter);

    fetch(`${API_BASE}/shoppers?${params}`)
      .then(r => r.json())
      .then(d => { setShoppers(d.shoppers || []); setTotal(d.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / LIMIT);

  const rfmColor = (score) => {
    if (score >= 4) return 'var(--primary)';
    if (score >= 3) return '#059669';
    if (score >= 2) return '#d97706';
    return 'var(--error)';
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div className="flex-row justify-between">
        <div>
          <h2 className="text-h2">Shoppers</h2>
          <p className="text-body-sm" style={{ marginTop: '4px' }}>{total.toLocaleString()} total shoppers, sorted by lifetime value</p>
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="form-input"
          style={{ width: 'auto' }}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="AT_RISK">AT_RISK</option>
          <option value="CHURNED">CHURNED</option>
          <option value="VIP">VIP</option>
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface-variant)' }}>
              {['Customer', 'Status', 'Recency', 'Frequency', 'Monetary', 'LTV', 'Profile'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--on-surface-variant)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>Loading shoppers...</td></tr>
            ) : shoppers.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>No shoppers found.</td></tr>
            ) : shoppers.map((s, i) => (
              <tr key={s._id} style={{ borderBottom: '1px solid var(--outline-variant)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-container-lowest)', transition: 'background 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-variant)'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-container-lowest)'}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--on-surface)' }}>{s.firstName} {s.lastName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>{s.customerId}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span className={`badge ${s.status === 'ACTIVE' || s.status === 'VIP' ? 'badge-success' : s.status === 'AT_RISK' ? 'badge-warning' : 'badge-neutral'}`}>{s.status}</span>
                </td>
                {['recency', 'frequency', 'monetary'].map(k => (
                  <td key={k} style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: rfmColor(s.rfm?.[k]) }}>{s.rfm?.[k] ?? '—'}</span>
                    <span style={{ color: 'var(--on-surface-variant)' }}>/5</span>
                  </td>
                ))}
                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--primary)' }}>
                  ${(s.rfm?.totalLifetimeValue ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setSelectedCustomerId(s.customerId)}>
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-row justify-between" style={{ marginTop: 'var(--spacing-sm)' }}>
          <span className="text-body-sm">Page {page} of {totalPages}</span>
          <div className="flex-row gap-sm">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}

      {selectedCustomerId && (
        <ShopperDetailModal customerId={selectedCustomerId} onClose={() => setSelectedCustomerId(null)} />
      )}
    </div>
  );
}
