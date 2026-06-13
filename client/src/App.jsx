import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopNavBar from './components/TopNavBar';
import Campaigns from './views/Campaigns';
import CampaignDetail from './views/CampaignDetail';
import Shoppers from './views/Shoppers';
import CreateCampaignModal from './components/CreateCampaignModal';
import CommandCenter from './views/CommandCenter';
import SavedTemplates from './views/SavedTemplates';

const API_BASE = 'http://localhost:4000/api';

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const handleConvertOpportunity = async (oppId) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/opportunities/${oppId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      navigate(`/campaigns/${data.campaign._id}`);
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  };

  const handleCreateCampaign = async (payload) => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Campaign creation failed');
      navigate(`/campaigns/${data.campaign._id}`);
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message);
      console.error(err);
    }
  };

  const getTitle = () => {
    if (location.pathname.startsWith('/campaigns/')) return 'Campaign Bandit';
    switch (location.pathname) {
      case '/': return 'Command Center';
      case '/campaigns': return 'Campaigns';
      case '/templates': return 'Saved Templates';
      case '/shoppers': return 'Shoppers';
      default: return 'Enterprise AI CRM';
    }
  };

  return (
    <div className="app-container">
      <Sidebar />

      <div className="main-content">
        <TopNavBar title={getTitle()} />

        {/* Global error toast */}
        {error && (
          <div style={{ background: 'var(--error-container)', color: 'var(--error)', padding: '12px 24px', borderBottom: '1px solid var(--error)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="flex-row gap-sm">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
              {error}
            </div>
            <button className="btn-ghost" onClick={() => setError(null)}><span className="material-symbols-outlined">close</span></button>
          </div>
        )}

        <main className="scrollable-area">
          <Routes>
            <Route path="/" element={<CommandCenter />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/templates" element={<SavedTemplates />} />
            <Route path="/shoppers" element={<Shoppers />} />
          </Routes>
        </main>
      </div>

      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  );
}

export default App;
