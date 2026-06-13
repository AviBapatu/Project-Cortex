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

export default function SavedTemplates() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const LIMIT = 20;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT), isSaved: 'true' });
    
    Promise.all([
      fetch(`${API_BASE}/campaigns?${params}`).then(r => r.json()),
      fetch(`${API_BASE}/opportunities?isSaved=true&status=all`).then(r => r.json())
    ])
      .then(([campData, oppData]) => { 
        setCampaigns(campData.campaigns || []); 
        setTotal(campData.total || 0); 
        setOpportunities(oppData.opportunities || []);
        setLoading(false); 
      })
      .catch(() => setLoading(false));
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUnsaveOpp = async (oppId) => {
    try {
      await fetch(`${API_BASE}/opportunities/${oppId}/toggle-save`, { method: 'POST' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

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
          <h2 className="text-h2">Saved Templates</h2>
          <p className="text-body-sm" style={{ marginTop: '4px' }}>{total} saved campaigns total</p>
        </div>
      </div>

      {/* Saved Opportunities List */}
      <div className="flex-col gap-md">
        <h3 className="text-h3" style={{ marginTop: '16px' }}>Saved Opportunities</h3>
        {loading ? (
          <p className="text-body-sm">Loading opportunities...</p>
        ) : opportunities.length === 0 ? (
          <p className="text-body-sm" style={{ color: 'var(--cc-text-secondary)' }}>No saved opportunities.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--spacing-md)' }}>
            {opportunities.map((opp) => (
              <div key={opp._id} className="card" style={{ padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 className="text-h3">{opp.llmTitle}</h4>
                  <button 
                    onClick={() => handleUnsaveOpp(opp._id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                    title="Unsave Opportunity"
                  >
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '20px' }}>bookmark</span>
                  </button>
                </div>
                <p className="text-body-sm" style={{ flex: 1 }}>{opp.llmDescription}</p>
                <div className="text-caption" style={{ color: 'var(--on-surface-variant)', fontWeight: 600 }}>
                  {opp.audienceMatchCount} matches
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--outline-variant)', margin: 'var(--spacing-lg) 0' }} />

      {/* Campaign List */}
      <div className="flex-col gap-md">
        <h3 className="text-h3">Saved Campaigns</h3>
        {loading ? (
          <p className="text-body-sm">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline)' }}>bookmark</span>
            <p className="text-body-sm" style={{ marginTop: '8px' }}>No saved templates found.</p>
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
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex-row gap-md" style={{ justifyContent: 'center', marginTop: 'var(--spacing-md)' }}>
          <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </button>
          <span className="text-body-sm" style={{ alignSelf: 'center' }}>
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
