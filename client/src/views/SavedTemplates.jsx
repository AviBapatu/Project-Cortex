import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './SavedTemplates.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

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

  const getStatusNode = (status) => {
    if (status === 'DRAFT') {
      return (
        <span className="st-status-badge st-status-draft">
          DRAFT
        </span>
      );
    }
    if (status === 'EXECUTING') {
      return (
        <span className="st-status-badge st-status-executing">
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#C1542F', display: 'inline-block' }}></span>
          EXECUTING
        </span>
      );
    }
    if (status === 'COMPLETED') {
      return (
        <span className="st-status-badge st-status-completed">
          COMPLETED
        </span>
      );
    }
    return (
      <span className="st-status-badge st-status-draft">
        {status}
      </span>
    );
  };

  const pct = (camp) => ((camp.processed / Math.max(1, camp.audienceSize)) * 100).toFixed(0);

  return (
    <div className="st-container">
      {/* Left Panel: Saved Opportunities */}
      <section className="st-left">
        <div className="st-header">
          <h2 className="font-headline-lg" style={{ color: 'var(--on-surface)' }}>Saved Opportunities</h2>
          <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '8px' }}>
            AI-identified audience segments ready for activation.
          </p>
        </div>
        
        <div className="st-content custom-scrollbar">
          {loading ? (
            <p className="font-body-md" style={{ color: 'var(--on-surface-variant)' }}>Loading opportunities...</p>
          ) : opportunities.length === 0 ? (
            <p className="font-body-md" style={{ color: 'var(--on-surface-variant)' }}>No saved opportunities.</p>
          ) : (
            <div className="st-cards-gap">
              {opportunities.map((opp) => (
                <article key={opp._id} className={`ai-border-wrapper st-opp-card`}>
                  <div className="st-opp-card-header">
                    <div className="st-opp-tag">
                      <span>Growth Signal</span>
                    </div>
                    <button 
                      onClick={() => handleUnsaveOpp(opp._id)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: 'var(--secondary)' }}
                      title="Unsave Opportunity"
                    >
                      <span className="material-symbols-outlined fill" style={{ fontSize: '24px' }}>bookmark</span>
                    </button>
                  </div>
                  <h3 className="font-headline-md st-opp-title">{opp.llmTitle}</h3>
                  <p className="font-body-md st-opp-desc">{opp.llmDescription}</p>
                  <div className="st-opp-stats">
                    <div className="st-stat-col">
                      <span className="st-stat-label">Matching Members</span>
                      <span className="font-data-mono st-stat-value">{opp.audienceMatchCount?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Left Pagination */}
        <div className="st-pagination">
          <button 
            className="btn-ghost" 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ display: 'flex', opacity: page === 1 ? 0.5 : 1 }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="font-label-md" style={{ color: 'var(--on-surface-variant)' }}>
            {page} of {totalPages || 1}
          </span>
          <button 
            className="btn-ghost" 
            disabled={page === totalPages || totalPages === 0} 
            onClick={() => setPage(p => p + 1)}
            style={{ display: 'flex', opacity: (page === totalPages || totalPages === 0) ? 0.5 : 1 }}
          >
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </section>

      {/* Right Panel: Campaign Templates */}
      <section className="st-right">
        <div className="st-header">
          <div className="st-header-flex">
            <div>
              <h2 className="font-headline-lg" style={{ color: 'var(--on-surface)' }}>Campaign Templates</h2>
              <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '8px' }}>
                Reusable architectures for structured engagement.
              </p>
            </div>
          </div>
        </div>

        <div className="st-content custom-scrollbar" style={{ padding: '0 32px 32px 32px' }}>
          {loading ? (
            <p className="font-body-md" style={{ color: 'var(--on-surface-variant)' }}>Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline-variant)' }}>bookmark</span>
              <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '16px' }}>No saved templates found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="st-table-header">
                <div>Campaign Name &amp; Goal</div>
                <div>Target Audience</div>
                <div>Status</div>
                <div style={{ textAlign: 'right' }}>Progress</div>
              </div>

              {campaigns.map((camp) => (
                <div 
                  key={camp._id} 
                  className="st-table-row"
                  onClick={() => navigate(`/campaigns/${camp._id}`)}
                >
                  <div className="st-row-title-col">
                    <span className="st-row-title">{camp.name}</span>
                    <span className="st-row-desc">Goal: {camp.goal || 'General Engagement'}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="st-audience-tag">
                      {camp.audienceSize ? `${camp.audienceSize.toLocaleString()} Users` : 'All Active'}
                    </span>
                  </div>
                  
                  <div>
                    {getStatusNode(camp.status)}
                  </div>
                  
                  <div className="st-progress-col">
                    <span className="font-data-mono" style={{ color: camp.status === 'DRAFT' ? 'var(--outline-variant)' : 'var(--on-surface)' }}>
                      {camp.status === 'DRAFT' ? '--' : `${pct(camp)}%`}
                    </span>
                    <div className="st-action-hover">
                      <button className="st-action-btn" onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${camp._id}`); }} title="Open in Studio">
                        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit_square</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
