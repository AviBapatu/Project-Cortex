import React, { useEffect, useState } from 'react';
import { useDiscovery } from '../hooks/useDiscovery';
import { useLaunch } from '../hooks/useLaunch';
import { useNavigate } from 'react-router-dom';
import CreateCampaignModal from '../components/CreateCampaignModal';
import './Shoppers.css';

const API_BASE = 'http://localhost:4000/api';

export default function Shoppers() {
  const [query, setQuery] = useState('');
  const [selectedTwin, setSelectedTwin] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { discover, loading: discovering, error: discoverError, results: discoveryResults } = useDiscovery();
  const { launch, launching, error: launchError } = useLaunch();
  const navigate = useNavigate();
  
  // Shoppers list state (Pagination & Filtering)
  const [shoppersList, setShoppersList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [totalShoppersCount, setTotalShoppersCount] = useState(0);

  useEffect(() => {
    setLoadingList(true);
    let url = `${API_BASE}/shoppers?limit=20&page=${page}`;
    if (filterStatus) url += `&status=${filterStatus}`;
    if (filterSearch) url += `&search=${encodeURIComponent(filterSearch)}`;
    
    fetch(url)
      .then(r => r.json())
      .then(d => { 
        setShoppersList(d.shoppers || []); 
        setTotalPages(Math.ceil((d.total || 0) / 20) || 1);
        setTotalShoppersCount(d.total || 0);
        setLoadingList(false); 
      })
      .catch(() => setLoadingList(false));
  }, [page, filterStatus, filterSearch]);

  const handleSearch = () => {
    if (query.trim()) {
      setSelectedTwin(null);
      discover(query);
    }
  };

  const handleLaunchCampaign = async (payload) => {
    const fullPayload = {
      ...payload,
      queryBreakdown: discoveryResults?.queryBreakdown,
      rfmFilters: discoveryResults?.segmentQuery
    };
    const id = await launch(fullPayload);
    if (id) {
      setIsModalOpen(false);
      navigate(`/campaigns/${id}`);
    }
  };

  const getRfmPct = (score) => (score / 5) * 100;

  const twins = discoveryResults ? discoveryResults.audienceSample : shoppersList;
  const isSearchActive = !!discoveryResults;

  return (
    <div className="shoppers-container">
      {/* Spotlight Search */}
      <section className="spotlight-wrapper">
        <div className="spotlight-inner">
          <div className="ai-gradient-border" style={{ borderRadius: '26px' }}>
            <div className="spotlight-input-container" onClick={() => document.getElementById('ai-search-input').focus()}>
              <span className="material-symbols-outlined" style={{ color: 'var(--sienna)', marginRight: '16px', marginTop: '6px', fontVariationSettings: "'FILL' 1" }}>radar</span>
              <textarea 
                id="ai-search-input"
                className="spotlight-input custom-scrollbar"
                placeholder="Weekend hikers who love budget gear..."
                value={query}
                rows={1}
                style={{ resize: 'none', overflowY: 'hidden', minHeight: '34px', padding: 0, margin: 0, outline: 'none' }}
                onChange={e => {
                  setQuery(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                disabled={discovering}
              />
              <button 
                className="btn-primary" 
                style={{ marginLeft: '16px', padding: '10px 24px' }}
                onClick={handleSearch}
                disabled={discovering}
              >
                {discovering ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Split Panel */}
      <div className="shoppers-split">
        {/* Left Panel: 40% */}
        <aside className="shoppers-left">
          <header className="shoppers-left-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="font-headline-md text-primary m-0">{isSearchActive ? 'Found Twins' : 'All Shoppers'}</h2>
              <span className="font-label-md" style={{ backgroundColor: 'rgba(163,62,27,0.1)', color: 'var(--sienna)', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
                {isSearchActive ? `${discoveryResults?.audienceSize?.toLocaleString() || 0} Results` : `${totalShoppersCount.toLocaleString()} Total`}
              </span>
            </div>
            
            {!isSearchActive && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Search name or email..." 
                  value={filterSearch}
                  onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(196, 199, 202, 0.4)', outline: 'none' }}
                />
                <select 
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(196, 199, 202, 0.4)', outline: 'none', backgroundColor: 'white', cursor: 'pointer' }}
                >
                  <option value="">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CHURNED">Churned</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="EMBEDDING_PENDING">Pending</option>
                </select>
              </div>
            )}
          </header>
          
          <div className="shoppers-twins-list custom-scrollbar">
            {discovering ? (
              <p className="font-body-md" style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: '24px' }}>Running Vector Search...</p>
            ) : discoverError ? (
              <p className="font-body-md" style={{ color: 'var(--error)', padding: '24px' }}>Error: {discoverError}</p>
            ) : twins.length === 0 ? (
              <p className="font-body-md" style={{ textAlign: 'center', color: 'var(--on-surface-variant)', padding: '24px' }}>No shoppers found.</p>
            ) : (
              twins.map(twin => (
                <div 
                  key={twin.customerId || twin._id} 
                  className={`twin-card ${selectedTwin?.customerId === (twin.customerId || twin._id) ? 'active' : ''}`}
                  onClick={() => setSelectedTwin(twin)}
                >
                  <div className="twin-card-header">
                    <h3 className="twin-card-name">{twin.firstName} {twin.lastName}</h3>
                    <span className="twin-card-ltv">${(twin.rfm?.totalLifetimeValue || 0).toLocaleString()} LTV</span>
                  </div>
                  <div className="twin-rfm-bars">
                    {['recency', 'frequency', 'monetary'].map(key => {
                      const score = twin.rfm?.[`${key}Score`] || 0;
                      return (
                        <div key={key} className="twin-rfm-row">
                          <span className="twin-rfm-label">{key[0]}</span>
                          <div className="twin-rfm-track">
                            <div className="twin-rfm-fill" style={{ width: `${getRfmPct(score)}%` }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {!isSearchActive && totalPages > 1 && (
            <footer className="shoppers-left-footer" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(196, 199, 202, 0.2)' }}>
              <button 
                className="btn-ghost" 
                disabled={page <= 1} 
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="font-label-md" style={{ color: 'var(--on-surface-variant)' }}>
                Page {page} of {totalPages}
              </span>
              <button 
                className="btn-ghost" 
                disabled={page >= totalPages} 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </footer>
          )}
        </aside>

        {/* Right Panel: 60% */}
        <section className="shoppers-right custom-scrollbar">
          {selectedTwin ? (
            <>
              {isSearchActive && discoveryResults?.queryBreakdown && (
                <div className="ai-gradient-border xai-banner">
                  <div className="xai-banner-inner">
                    <span className="material-symbols-outlined" style={{ color: 'var(--sienna)', fontVariationSettings: "'FILL' 1" }}>sparkles</span>
                    <div>
                      <h4 className="xai-title">XAI Match Reasoning</h4>
                      <p className="xai-text">
                        {discoveryResults.queryBreakdown.reasoning}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="twin-detail-content">
                <div className="twin-detail-header" style={{ marginTop: isSearchActive ? '0' : '40px' }}>
                  <div>
                    <h1 className="font-display-lg text-primary m-0" style={{ marginBottom: '8px' }}>Digital Twin Summary</h1>
                    <p className="twin-archetype">Name: <span style={{ fontWeight: 'bold', color: 'var(--sienna)' }}>{selectedTwin.firstName} {selectedTwin.lastName}</span></p>
                    {(selectedTwin.digitalTwinSummary || selectedTwin.ai?.digitalTwinSummary) && (
                      <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '8px', fontStyle: 'italic' }}>
                        "{selectedTwin.digitalTwinSummary || selectedTwin.ai?.digitalTwinSummary}"
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button className="btn-secondary">Export Twin</button>
                    {isSearchActive && <button className="btn-primary" onClick={() => setIsModalOpen(true)}>Launch Campaign</button>}
                  </div>
                </div>

                <div className="twin-stats-grid">
                  <div className="twin-stat-box">
                    <span className="font-label-md" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lifetime Value</span>
                    <div className="font-headline-lg text-primary" style={{ marginTop: '8px' }}>${(selectedTwin.rfm?.totalLifetimeValue || 0).toLocaleString()}</div>
                  </div>
                  <div className="twin-stat-box">
                    <span className="font-label-md" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
                    <div className="font-headline-md text-primary" style={{ marginTop: '8px' }}>{selectedTwin.status || 'ACTIVE'}</div>
                  </div>
                  <div className="twin-stat-box">
                    <span className="font-label-md" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Search Score</span>
                    <div className="font-headline-lg text-primary" style={{ marginTop: '8px' }}>
                      {selectedTwin.searchScore ? `${Math.round(selectedTwin.searchScore * 100)}%` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="twin-rfm-profile">
                  <h3 className="font-headline-md text-primary m-0">RFM Behavioral Profile</h3>
                  
                  {['recency', 'frequency', 'monetary'].map(key => {
                    const label = key.charAt(0).toUpperCase() + key.slice(1);
                    const score = selectedTwin.rfm?.[`${key}Score`] || 0;
                    return (
                      <div key={key} className="rfm-detail-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="font-body-lg" style={{ fontWeight: 600 }}>{label}</span>
                          <span className="font-data-mono">{score} / 5</span>
                        </div>
                        <div style={{ height: '16px', backgroundColor: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', backgroundColor: 'var(--sienna)', width: `${getRfmPct(score)}%` }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--outline)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '64px', marginBottom: '16px' }}>person_search</span>
              <p className="font-headline-md">Select a shopper profile</p>
            </div>
          )}
        </section>
      </div>

      <CreateCampaignModal 
        key={isModalOpen ? 'open' : 'closed'}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleLaunchCampaign}
        initialSegment={query}
      />
    </div>
  );
}
