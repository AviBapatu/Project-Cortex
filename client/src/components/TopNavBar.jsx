import React from 'react';

export default function TopNavBar({ title }) {
  return (
    <header className="topbar-container justify-between">
      <div className="flex-row gap-md">
        <h2 className="text-h2">{title}</h2>
      </div>
      <div className="flex-row gap-md">
        <button className="btn-ghost" style={{ borderRadius: '50%' }}>
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--primary-container)', color: 'var(--on-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          AC
        </div>
      </div>
    </header>
  );
}
