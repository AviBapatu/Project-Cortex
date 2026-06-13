import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:4000/api';

const STATUS_COLORS = {
  DRAFT: 'badge-neutral',
  EXECUTING: 'badge-warning',
  OPTIMIZING: 'badge-info',
  COMPLETED: 'badge-success',
  FAILED: { background: 'var(--error-container)', color: 'var(--error)' },
};

export default function Campaigns() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const LIMIT = 20;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter) params.set('status', statusFilter);
    fetch(`${API_BASE}/campaigns?${params}`)
      .then(r => r.json())
      .then(d => { setCampaigns(d.campaigns || []); setTotal(d.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / LIMIT);

  const getBadge = (status) => {
    const cls = STATUS_COLORS[status];
    if (typeof cls === 'string') return <span className={`badge ${cls}`}>{status}</span>;
    return <span className="badge" style={cls}>{status}</span>;
  };

  const pct = (camp) => ((camp.processed / Math.max(1, camp.audienceSize)) * 100).toFixed(0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div className="flex-row justify-between">
        <div>
          <h2 className="text-h2">All Campaigns</h2>
          <p className="text-body-sm" style={{ marginTop: '4px' }}>{total} campaigns total</p>
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="form-input"
          style={{ width: 'auto' }}
        >
          <option value="">All Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="EXECUTING">EXECUTING</option>
          <option value="OPTIMIZING">OPTIMIZING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>

      {/* Campaign List */}
      <div className="flex-col gap-md">
        {loading ? (
          <p className="text-body-sm">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline)' }}>campaign</span>
            <p className="text-body-sm" style={{ marginTop: '8px' }}>No campaigns found.</p>
          </div>
        ) : (
          campaigns.map((camp, i) => (
            <div
              key={camp._id}
              className="card"
              style={{ padding: 'var(--spacing-md)', cursor: 'pointer', gap: 0 }}
              onClick={() => navigate(`/campaigns/${camp._id}`)}
            >
              <div className="flex-row justify-between" style={{ marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <h4 className="text-h3">{camp.name}</h4>
                  <p className="text-body-sm" style={{ marginTop: '2px' }}>{camp.goal}</p>
                </div>
                <div className="flex-row gap-lg" style={{ flexShrink: 0 }}>
                  {getBadge(camp.status)}
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-caption">Audience</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--on-surface)' }}>{camp.audienceSize?.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-caption">Progress</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--on-surface)' }}>{pct(camp)}%</div>
                  </div>
                  <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>chevron_right</span>
                </div>
              </div>
              {/* Progress bar */}
              {(camp.status === 'EXECUTING' || camp.status === 'OPTIMIZING' || camp.status === 'COMPLETED') && (
                <div className="progress-bg" style={{ marginTop: '8px' }}>
                  <div className="progress-fill" style={{ width: `${pct(camp)}%`, background: camp.status === 'COMPLETED' ? '#059669' : 'var(--primary)' }}></div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-row justify-between">
          <span className="text-body-sm">Page {page} of {totalPages}</span>
          <div className="flex-row gap-sm">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
