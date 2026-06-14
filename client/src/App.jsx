import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink } from 'react-router-dom';
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

  return (
    <div className="app-container">
      {/* TopNavBar (Shared Component) */}
      <nav className="topbar-nav">
        <div className="topbar-nav-inner glass-nav">
          <div className="topbar-brand font-headline-md text-lg">
            Project Cortex
          </div>
          <div className="topbar-links">
            <NavLink to="/" end className={({ isActive }) => `topbar-link font-label-md ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
            <NavLink to="/shoppers" className={({ isActive }) => `topbar-link font-label-md ${isActive ? 'active' : ''}`}>Audiences</NavLink>
            <NavLink to="/campaigns" className={({ isActive }) => `topbar-link font-label-md ${isActive || location.pathname.startsWith('/campaigns/') ? 'active' : ''}`}>Campaigns</NavLink>
            <NavLink to="/templates" className={({ isActive }) => `topbar-link font-label-md ${isActive ? 'active' : ''}`}>Templates</NavLink>
          </div>
          <div className="topbar-icons">
            <span className="material-symbols-outlined topbar-icon">auto_awesome</span>
            <span className="material-symbols-outlined topbar-icon">notifications</span>
            <span className="material-symbols-outlined topbar-icon">account_circle</span>
          </div>
        </div>
      </nav>

      {/* Global error toast */}
      {error && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: 'var(--error-container)', color: 'var(--error)', padding: '12px 24px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>error</span>
          {error}
          <button className="btn-ghost" style={{ padding: '4px' }} onClick={() => setError(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<CommandCenter />} />
          <Route path="/campaigns" element={<Campaigns />}>
            <Route path=":id" element={<CampaignDetail />} />
          </Route>
          <Route path="/templates" element={<SavedTemplates />} />
          <Route path="/shoppers" element={<Shoppers />} />
        </Routes>
      </main>

      <CreateCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />
    </div>
  );
}

export default App;
