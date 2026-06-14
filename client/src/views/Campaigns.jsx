import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, Outlet } from 'react-router-dom';
import './Campaigns.css';

const API_BASE = 'http://localhost:4000/api';

export default function Campaigns() {
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const [campaigns, setCampaigns] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const LIMIT = 20;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter);
    fetch(`${API_BASE}/campaigns?${params}`)
      .then(r => r.json())
      .then(d => { setCampaigns(d.campaigns || []); setTotal(d.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pct = (camp) => ((camp.processed / Math.max(1, camp.audienceSize)) * 100).toFixed(0);

  const getStatusClass = (status) => {
    if (status === 'EXECUTING' || status === 'OPTIMIZING') return 'active';
    if (status === 'COMPLETED') return 'completed';
    return 'scheduled'; // DRAFT or scheduled
  };

  const filters = ['All', 'EXECUTING', 'COMPLETED', 'DRAFT'];

  return (
    <div className="split-layout">
      {/* Left Panel: Navigation/List (40%) */}
      <section className="split-left">
        <div className="campaigns-header">
          <div className="flex-row justify-between" style={{ marginBottom: '24px' }}>
            <h1 className="font-display-lg text-primary m-0" style={{ margin: 0 }}>Campaigns</h1>
            <button className="btn-primary" onClick={() => {/* handle new */}}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
              New Campaign
            </button>
          </div>

          {/* Filter Pills */}
          <div className="filter-pills scrollbar-hide">
            {filters.map(f => (
              <button
                key={f}
                className={`filter-pill ${statusFilter === f || (f === 'All' && statusFilter === '') ? 'active' : 'inactive'}`}
                onClick={() => { setStatusFilter(f === 'All' ? '' : f); setPage(1); }}
              >
                {f === 'EXECUTING' ? 'Active' : f}
              </button>
            ))}
          </div>

          {/* AI Search Input */}
          <div className="input-search-wrapper">
            <div className="input-search-bg"></div>
            <div className="input-search-inner">
              <span className="material-symbols-outlined text-lg" style={{ color: 'var(--sienna)', marginRight: '8px' }}>auto_awesome</span>
              <input 
                className="input-search" 
                placeholder="Ask AI to find campaigns or analyze performance..." 
                type="text"
              />
            </div>
          </div>
        </div>

        {/* Campaign List */}
        <div className="campaigns-list">
          {loading ? (
            <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '24px' }}>Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline-variant)' }}>campaign</span>
              <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '8px' }}>No campaigns found.</p>
            </div>
          ) : (
            campaigns.map((camp) => (
              <div
                key={camp._id}
                className={`campaign-card ${selectedId === camp._id ? 'active' : ''}`}
                onClick={() => navigate(`/campaigns/${camp._id}`)}
              >
                <div className="campaign-card-header">
                  <div className="campaign-card-title-group">
                    <span className="material-symbols-outlined campaign-icon">mail</span>
                    <h3 className="campaign-title">{camp.name}</h3>
                  </div>
                  <span className={`campaign-status ${getStatusClass(camp.status)}`}>
                    {camp.status}
                  </span>
                </div>
                
                <p className="campaign-desc">{camp.goal || 'No goal specified'}</p>
                
                <div className="campaign-stats">
                  <div className="campaign-stats-left">
                    <span><strong className="font-data-mono text-primary">{camp.processed.toLocaleString()}</strong> Sent</span>
                    <span><strong className="font-data-mono text-primary">{pct(camp)}%</strong> Prog</span>
                  </div>
                  <div className="campaign-stats-right">
                    $0K <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_up</span>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex-row justify-between" style={{ marginTop: '16px' }}>
              <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
              <span className="font-label-md" style={{ color: 'var(--on-surface-variant)' }}>Page {page}</span>
              <button className="btn-secondary" disabled={page >= Math.ceil(total / LIMIT)} onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          )}
        </div>
      </section>

      {/* Right Panel: Detail/Action (60%) */}
      <section className="split-right">
        {selectedId ? (
          <Outlet />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--outline)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '64px', marginBottom: '16px' }}>inbox</span>
            <p className="font-headline-md">Select a campaign</p>
          </div>
        )}
      </section>
    </div>
  );
}
