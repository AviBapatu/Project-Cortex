import React, { useState } from 'react';

export default function CreateCampaignModal({ isOpen, onClose, onSubmit, initialSegment = '' }) {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [segment, setSegment] = useState(initialSegment);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit({ name, goal, segmentDescription: segment });
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="font-headline-md m-0" style={{ color: 'var(--primary)' }}>Create AI Campaign</h3>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '4px' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Campaign Name</label>
            <input 
              type="text" 
              required 
              className="form-input" 
              placeholder="e.g., Summer Churn Recovery"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Goal / Promotion</label>
            <input 
              type="text" 
              required 
              className="form-input" 
              placeholder="e.g., 20% off next purchase"
              value={goal}
              onChange={e => setGoal(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Segment Description</label>
            <textarea 
              required 
              rows={3} 
              className="form-input" 
              placeholder="e.g., High LTV customers"
              value={segment}
              onChange={e => setSegment(e.target.value)}
            ></textarea>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ opacity: loading ? 0.5 : 1 }}>
              {loading ? 'Generating...' : 'Generate Variants'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
