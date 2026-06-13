import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  const navItems = [
    { id: '/', icon: 'dashboard', label: 'Command Center', exact: true },
    { id: '/shoppers', icon: 'people', label: 'Shoppers' },
    { id: '/campaigns', icon: 'campaign', label: 'Campaigns' },
    { id: '/templates', icon: 'bookmark', label: 'Saved Templates' },
  ];

  return (
    <aside className="sidebar-container">
      <div className="sidebar-brand">
        <div style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-primary)', fontWeight: 'bold' }}>
          CR
        </div>
        <div>
          <h1 style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1rem', lineHeight: 1.2 }}>Project Cortex</h1>
          <p className="text-caption">Enterprise AI CRM</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.id}
            to={item.id}
            end={item.exact}
            className={({ isActive }) => `sidebar-link ${isActive || (item.id === '/campaigns' && window.location.pathname.startsWith('/campaigns/')) ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: (isActive || (item.id === '/campaigns' && window.location.pathname.startsWith('/campaigns/'))) ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--outline-variant)' }}>
        <button className="sidebar-link" style={{ width: '100%', color: 'var(--on-surface-variant)' }}>
          <span className="material-symbols-outlined">settings</span>
          Settings
        </button>
      </div>
    </aside>
  );
}
