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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // LAYOUT STATE
  const [widths, setWidths] = useState(() => {
    const saved = localStorage.getItem('ide-widths');
    return saved ? JSON.parse(saved) : { left: 350, middle: 400 };
  });

  const [panes, setPanes] = useState(() => {
    const saved = localStorage.getItem('ide-panes');
    return saved ? JSON.parse(saved) : { left: true, middle: true, right: true };
  });

  useEffect(() => {
    localStorage.setItem('ide-widths', JSON.stringify(widths));
  }, [widths]);

  useEffect(() => {
    localStorage.setItem('ide-panes', JSON.stringify(panes));
  }, [panes]);

  const togglePane = (pane) => {
    setPanes(prev => {
      const isCurrentlyOpen = prev[pane];
      if (isCurrentlyOpen) {
        const openCount = Object.values(prev).filter(Boolean).length;
        if (openCount <= 2) {
          // Rule: at least two columns must remain open
          return prev;
        }
      }
      return { ...prev, [pane]: !prev[pane] };
    });
  };

  const expandPane = (pane) => {
    if (!panes[pane]) togglePane(pane);
  };

  // RESIZING LOGIC
  const [isDragging, setIsDragging] = useState(null);

  const startResizing = (resizer, e) => {
    e.preventDefault();
    setIsDragging(resizer);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const maxWidth = window.innerWidth * 0.6;
      if (isDragging === 'left') {
        let newWidth = e.clientX;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > maxWidth) newWidth = maxWidth;
        setWidths(prev => ({ ...prev, left: newWidth }));
      } else if (isDragging === 'middle') {
        let offset = panes.left ? widths.left + 4 : 54; // 50px if closed + 4px resizer
        let newWidth = e.clientX - offset;
        if (newWidth < 200) newWidth = 200;
        if (newWidth > maxWidth) newWidth = maxWidth;
        setWidths(prev => ({ ...prev, middle: newWidth }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, panes.left, widths.left]);

  const LIMIT = 20;

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter);
    if (activeSearch) params.set('search', activeSearch);
    fetch(`${API_BASE}/campaigns?${params}`)
      .then(r => r.json())
      .then(d => { setCampaigns(d.campaigns || []); setTotal(d.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [page, statusFilter, activeSearch]);

  const handleToggleSave = async (campaignId) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/toggle-save`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(prev => prev.map(c => c._id === campaignId ? { ...c, isSaved: data.isSaved } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  const pct = (camp) => ((camp.processed / Math.max(1, camp.audienceSize)) * 100).toFixed(0);

  const getStatusClass = (status) => {
    if (status === 'EXECUTING' || status === 'OPTIMIZING') return 'active';
    if (status === 'COMPLETED') return 'completed';
    return 'scheduled'; // DRAFT or scheduled
  };

  const filters = ['All', 'EXECUTING', 'COMPLETED', 'DRAFT'];

  // GRID STYLE LOGIC
  const getGridStyle = () => {
    let l = panes.left ? `${widths.left}px` : '50px';
    let m = panes.middle ? `${widths.middle}px` : '50px';
    let r = panes.right ? '1fr' : '50px';

    if (!panes.right && !panes.middle) {
      if (panes.left) l = '1fr';
    } else if (!panes.right) {
      if (panes.middle) m = '1fr';
    }

    let r1 = panes.left && (panes.middle || panes.right) ? '4px' : '0px';
    let r2 = panes.middle && panes.right ? '4px' : '0px';

    return {
      '--left-width': l,
      '--resizer-1': r1,
      '--middle-width': m,
      '--resizer-2': r2,
      '--right-width': r
    };
  };

  return (
    <div className={`ide-layout-container ${isDragging ? 'is-dragging' : ''}`} style={getGridStyle()}>
      
      {/* 1. Left Pane: Campaign List */}
      <div 
        className={`workspace-pane pane-left ${panes.left ? 'open' : 'closed'}`}
        onClick={() => expandPane('left')}
      >
        {panes.left ? (
          <div className="pane-header-strip">
            <button className="pane-toggle-btn" onClick={(e) => { e.stopPropagation(); togglePane('left'); }}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          </div>
        ) : (
          <span className="material-symbols-outlined collapsed-vertical-icon">view_list</span>
        )}
        <div className="pane-content left-pane-content custom-scrollbar">
          <div className="pane-inner-padding" style={{ padding: '0 24px 48px 24px' }}>
            
            <div className="campaigns-header" style={{ padding: '0', marginBottom: '16px' }}>
              <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
                <h1 className="font-display-lg text-primary m-0" style={{ margin: 0, fontSize: '24px' }}>Campaigns</h1>
                <button className="btn-primary" onClick={() => navigate('/campaigns', { state: { createCampaign: true } })} style={{ padding: '6px 12px', fontSize: '14px' }}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '18px' }}>add</span>
                  New
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
              <div className="input-search-wrapper" style={{ marginTop: '16px' }}>
                <div className="input-search-bg"></div>
                <div className="input-search-inner">
                  <span 
                    className="material-symbols-outlined text-lg" 
                    style={{ color: 'var(--sienna)', marginRight: '8px', cursor: 'pointer' }}
                    onClick={() => {
                      setPage(1);
                      setActiveSearch(searchQuery);
                    }}
                  >
                    auto_awesome
                  </span>
                  <input 
                    className="input-search" 
                    placeholder="Ask AI..." 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (val.trim() === '') {
                        setPage(1);
                        setActiveSearch('');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setPage(1);
                        setActiveSearch(searchQuery.trim());
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Campaign List */}
            <div className="campaigns-list" style={{ padding: '0' }}>
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
                      <div className="campaign-card-title-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="material-symbols-outlined campaign-icon">mail</span>
                        <h3 className="campaign-title" style={{ fontSize: '16px' }}>{camp.name}</h3>
                      </div>
                      <button 
                        className="btn-ghost" 
                        onClick={(e) => { e.stopPropagation(); handleToggleSave(camp._id); }}
                        style={{ padding: '4px', display: 'flex', alignItems: 'center', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                        title="Save Template"
                      >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: camp.isSaved ? "'FILL' 1" : "'FILL' 0", fontSize: '20px', color: camp.isSaved ? 'var(--sienna)' : 'var(--outline-variant)' }}>bookmark</span>
                      </button>
                    </div>
                    
                    <p className="campaign-desc" style={{ marginBottom: '8px', fontSize: '12px' }}>{camp.goal || 'No goal specified'}</p>
                    
                    <div className="campaign-stats">
                      <div className="campaign-stats-left">
                        <span className={`campaign-status ${getStatusClass(camp.status)}`}>{camp.status}</span>
                      </div>
                      <div className="campaign-stats-right">
                        <span><strong className="font-data-mono text-primary">{pct(camp)}%</strong> Prog</span>
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

          </div>
        </div>
      </div>

      {/* 2. Resizer 1 (Left-Middle) */}
      <div 
        className={`pane-resizer ${isDragging === 'left' ? 'active' : ''}`}
        onMouseDown={panes.left && (panes.middle || panes.right) ? (e) => startResizing('left', e) : undefined}
      ></div>

      {selectedId ? (
        <Outlet context={{ panes, togglePane, expandPane, startResizing, isDragging }} />
      ) : (
        <>
          {/* 3. Empty Middle Pane */}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--outline)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '64px', marginBottom: '16px' }}>inbox</span>
                <p className="font-headline-md">Select a campaign</p>
              </div>
            </div>
          </div>
          
          {/* 4. Resizer 2 (Middle-Right) */}
          <div 
            className={`pane-resizer ${isDragging === 'middle' ? 'active' : ''}`}
            onMouseDown={panes.middle && panes.right ? (e) => startResizing('middle', e) : undefined}
          ></div>

          {/* 5. Empty Right Pane */}
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
            </div>
          </div>
        </>
      )}

    </div>
  );
}
