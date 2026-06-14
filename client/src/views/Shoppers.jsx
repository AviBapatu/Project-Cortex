import React, { useEffect, useState } from 'react';
import { useDiscovery } from '../hooks/useDiscovery';
import { useLaunch } from '../hooks/useLaunch';
import { useNavigate } from 'react-router-dom';
import CreateCampaignModal from '../components/CreateCampaignModal';
import './Shoppers.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export default function Shoppers() {
  const [query, setQuery] = useState('');
  const [campaignGoal, setCampaignGoal] = useState('');
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
  const [filterMinLtv, setFilterMinLtv] = useState('');
  const [filterMinRecency, setFilterMinRecency] = useState('');
  const [totalShoppersCount, setTotalShoppersCount] = useState(0);

  useEffect(() => {
    setLoadingList(true);
    let url = `${API_BASE}/shoppers?limit=20&page=${page}`;
    if (filterStatus) url += `&status=${filterStatus}`;
    if (filterSearch) url += `&search=${encodeURIComponent(filterSearch)}`;
    if (filterMinLtv) url += `&minLtv=${filterMinLtv}`;
    if (filterMinRecency) url += `&minRecency=${filterMinRecency}`;
    
    fetch(url)
      .then(r => r.json())
      .then(d => { 
        setShoppersList(d.shoppers || []); 
        setTotalPages(Math.ceil((d.total || 0) / 20) || 1);
        setTotalShoppersCount(d.total || 0);
        setLoadingList(false); 
      })
      .catch(() => setLoadingList(false));
  }, [page, filterStatus, filterSearch, filterMinLtv, filterMinRecency]);

  const handleSearch = () => {
    if (query.trim()) {
      setSelectedTwin(null);
      discover(query);
    }
  };

  const handleLaunchCampaign = async (payload) => {
    let queryBreakdown = discoveryResults?.queryBreakdown;
    
    if (!isSearchActive) {
      queryBreakdown = {
        usedSemanticSearch: false,
        extractedFilters: {}
      };
      if (filterStatus) queryBreakdown.extractedFilters.status = filterStatus;
      if (filterSearch) queryBreakdown.extractedFilters.search = filterSearch;
      if (filterMinLtv) queryBreakdown.extractedFilters.minLtv = Number(filterMinLtv);
      if (filterMinRecency) queryBreakdown.extractedFilters.minRecency = Number(filterMinRecency);
    }

    const fullPayload = {
      ...payload,
      queryBreakdown,
      rfmFilters: discoveryResults?.segmentQuery
    };
    const id = await launch(fullPayload);
    if (id) {
      setIsModalOpen(false);
      navigate(`/campaigns/${id}`);
    }
  };

  const getRfmPct = (score) => (score / 5) * 100;

  const getScoreTier = (key, rawValue) => {
    if (key === 'recency') {
      if (rawValue <= 7) return 5;
      if (rawValue <= 30) return 4;
      if (rawValue <= 90) return 3;
      if (rawValue <= 180) return 2;
      return 1;
    }
    if (key === 'frequency') {
      if (rawValue >= 20) return 5;
      if (rawValue >= 10) return 4;
      if (rawValue >= 5) return 3;
      if (rawValue >= 2) return 2;
      return 1;
    }
    if (key === 'monetary') {
      if (rawValue >= 1000) return 5;
      if (rawValue >= 500) return 4;
      if (rawValue >= 200) return 3;
      if (rawValue >= 50) return 2;
      return 1;
    }
    return 0;
  };

  const twins = discoveryResults ? discoveryResults.audienceSample : shoppersList;
  const isSearchActive = !!discoveryResults;

  return (
    <div className="shoppers-container">
      {/* Spotlight Search */}
      <section className="spotlight-wrapper">
        <div className="spotlight-inner" style={{ display: 'flex', gap: '32px', alignItems: 'center', justifyContent: 'space-between', maxWidth: '100%' }}>
          
          {/* Left: Audience Search */}
          <div className="gemini-search-wrapper" style={{ flex: 1, maxWidth: '800px', margin: '0 auto' }}>
            <div className="spotlight-input-container" onClick={() => document.getElementById('ai-search-input').focus()}>
              <span className="material-symbols-outlined" style={{ color: 'var(--sienna)', marginRight: '16px', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <textarea 
                id="ai-search-input"
                className="spotlight-input custom-scrollbar"
                placeholder="Weekend hikers who love budget gear..."
                value={query}
                rows={1}
                style={{ resize: 'none', overflowY: 'hidden', minHeight: '24px', padding: 0, margin: 0, outline: 'none' }}
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

          {/* Right: Campaign Type & Launch */}
          <div className="spotlight-input-container" style={{ flexShrink: 0, width: '480px', padding: '16px 24px' }}>
            <textarea 
              className="spotlight-input custom-scrollbar"
              placeholder="Campaign Goal (e.g., 20% Off)..."
              value={campaignGoal}
              rows={1}
              style={{ flex: 1, margin: 0, resize: 'none', overflowY: 'hidden', minHeight: '24px', padding: 0, outline: 'none' }}
              onChange={e => {
                setCampaignGoal(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (campaignGoal.trim()) {
                    handleLaunchCampaign({ 
                      name: `${campaignGoal.trim()} Campaign`, 
                      goal: campaignGoal.trim(),
                      segmentDescription: isSearchActive ? query : 'Manually Filtered Audience'
                    });
                  } else {
                    setIsModalOpen(true);
                  }
                }
              }}
            />
            <button 
              className="btn-primary" 
              onClick={() => {
                if (campaignGoal.trim()) {
                  handleLaunchCampaign({ 
                    name: `${campaignGoal.trim()} Campaign`, 
                    goal: campaignGoal.trim(),
                    segmentDescription: isSearchActive ? query : 'Manually Filtered Audience'
                  });
                } else {
                  setIsModalOpen(true);
                }
              }}
              style={{ marginLeft: '16px', padding: '10px 24px', whiteSpace: 'nowrap' }}
            >
              Launch Campaign
            </button>
          </div>

        </div>
      </section>

      {/* Split Panel */}
      <div className="shoppers-split">
        {/* Left Panel: 40% */}
        <aside className="shoppers-left">
          <header className="shoppers-left-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h2 className="font-headline-md text-primary m-0">{isSearchActive ? 'Found Twins' : 'All Shoppers'}</h2>
                <span className="font-label-md" style={{ backgroundColor: 'rgba(163,62,27,0.1)', color: 'var(--sienna)', padding: '4px 12px', borderRadius: 'var(--radius-full)' }}>
                  {isSearchActive ? `${discoveryResults?.audienceSize?.toLocaleString() || 0} Results` : `${totalShoppersCount.toLocaleString()} Total`}
                </span>
              </div>
            </div>
            
            {!isSearchActive && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="number" 
                    placeholder="Min LTV (₹)" 
                    value={filterMinLtv}
                    onChange={(e) => { setFilterMinLtv(e.target.value); setPage(1); }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(196, 199, 202, 0.4)', outline: 'none' }}
                  />
                  <select 
                    value={filterMinRecency}
                    onChange={(e) => { setFilterMinRecency(e.target.value); setPage(1); }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(196, 199, 202, 0.4)', outline: 'none', backgroundColor: 'white', cursor: 'pointer' }}
                  >
                    <option value="">Any Recency Score</option>
                    <option value="2">2+ Stars</option>
                    <option value="3">3+ Stars</option>
                    <option value="4">4+ Stars</option>
                    <option value="5">5 Stars</option>
                  </select>
                </div>
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
                    <span className="twin-card-ltv">₹{(twin.rfm?.totalLifetimeValue || 0).toLocaleString()} LTV</span>
                  </div>
                  <div className="twin-rfm-bars">
                    {['recency', 'frequency', 'monetary'].map(key => {
                      const rawValue = twin.rfm?.[`${key}Score`] || 0;
                      const tier = getScoreTier(key, rawValue);
                      
                      let color = 'var(--sienna)';
                      if (key === 'recency') color = 'var(--primary-slate)';
                      if (key === 'frequency') color = 'var(--gold-glow)';

                      return (
                        <div key={key} className="twin-rfm-row">
                          <span className="twin-rfm-label">{key[0]}</span>
                          <div className="twin-rfm-track">
                            <div className="twin-rfm-fill" style={{ width: `${getRfmPct(tier)}%`, backgroundColor: color }}></div>
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
                <div className="twin-detail-header">
                  <div>
                    <h1 className="font-display-lg text-primary m-0" style={{ marginBottom: '16px' }}>Digital Twin Summary</h1>
                    <p className="twin-archetype" style={{ margin: 0, marginBottom: '16px' }}>Name: <span style={{ fontWeight: 'bold', color: 'var(--sienna)' }}>{selectedTwin.firstName} {selectedTwin.lastName}</span></p>
                    {(selectedTwin.digitalTwinSummary || selectedTwin.ai?.digitalTwinSummary) && (
                      <p className="font-body-md" style={{ color: 'var(--on-surface-variant)', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>
                        "{selectedTwin.digitalTwinSummary || selectedTwin.ai?.digitalTwinSummary}"
                      </p>
                    )}
                  </div>

                </div>

                <div className="twin-stats-grid">
                  <div className="twin-stat-box">
                    <span className="font-label-md" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lifetime Value</span>
                    <div className="font-headline-lg text-primary" style={{ marginTop: '8px' }}>₹{(selectedTwin.rfm?.totalLifetimeValue || 0).toLocaleString()}</div>
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
                    const rawValue = selectedTwin.rfm?.[`${key}Score`] || 0;
                    const tier = getScoreTier(key, rawValue);
                    
                    let color = 'var(--sienna)';
                    if (key === 'recency') color = 'var(--primary-slate)';
                    if (key === 'frequency') color = 'var(--gold-glow)';

                    let rangeText = '';
                    if (key === 'recency') {
                       if (tier === 5) rangeText = '≤ 7 Days';
                       else if (tier === 4) rangeText = '≤ 30 Days';
                       else if (tier === 3) rangeText = '≤ 90 Days';
                       else if (tier === 2) rangeText = '≤ 180 Days';
                       else rangeText = '> 180 Days';
                    }
                    if (key === 'frequency') {
                       if (tier === 5) rangeText = '20+ Orders';
                       else if (tier === 4) rangeText = '10-19 Orders';
                       else if (tier === 3) rangeText = '5-9 Orders';
                       else if (tier === 2) rangeText = '2-4 Orders';
                       else rangeText = '0-1 Orders';
                    }
                    if (key === 'monetary') {
                       if (tier === 5) rangeText = '₹1000+ LTV';
                       else if (tier === 4) rangeText = '₹500-₹999 LTV';
                       else if (tier === 3) rangeText = '₹200-₹499 LTV';
                       else if (tier === 2) rangeText = '₹50-₹199 LTV';
                       else rangeText = '< ₹50 LTV';
                    }

                    return (
                      <div key={key} className="rfm-detail-row">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="font-body-lg" style={{ fontWeight: 600 }}>{label}</span>
                          <span className="font-data-mono" style={{ color: 'var(--on-surface-variant)' }}>{rangeText}</span>
                        </div>
                        <div style={{ height: '16px', backgroundColor: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', backgroundColor: color, width: `${getRfmPct(tier)}%` }}></div>
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
        initialSegment={isSearchActive ? query : 'Manually Filtered Audience'}
        initialGoal={campaignGoal}
      />
    </div>
  );
}
