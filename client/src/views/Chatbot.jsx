import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Chatbot.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const CampaignProposalCard = ({ proposal, onApprove, onDiscard }) => {
  const [editableVariants, setEditableVariants] = useState(proposal.variants || []);

  const handleVariantChange = (index, newText) => {
    const updated = [...editableVariants];
    updated[index] = { ...updated[index], template: newText };
    setEditableVariants(updated);
  };

  return (
    <div className="cb-proposal-card">
      <div className="cb-proposal-header">
        <div>
          <span className="cb-proposal-kicker">Draft Campaign Proposal</span>
          <h3 className="cb-proposal-title">{proposal.name}</h3>
        </div>
        <span className="material-symbols-outlined cb-text-secondary">campaign</span>
      </div>
      <div className="cb-proposal-body">
        <p className="cb-proposal-detail">
          <span className="cb-proposal-detail-bold">Target Audience:</span> {proposal.segmentQuery?.semanticQuery || 'Generated segment'} 
          {proposal.audienceSize !== undefined && (
             <span style={{ marginLeft: '8px', padding: '2px 8px', backgroundColor: 'var(--primary-container)', color: 'var(--surface-bright)', borderRadius: '9999px', fontSize: '12px', fontWeight: 'bold' }}>
               {proposal.audienceSize} customers
             </span>
          )}
        </p>
        <p className="cb-proposal-detail">
          <span className="cb-proposal-detail-bold">Goal:</span> {proposal.goal}
        </p>
        
        <div style={{ marginTop: '12px' }}>
          <p className="cb-proposal-detail-muted" style={{ marginBottom: '8px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
            Generated Variants ({proposal.variants?.length || 0})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {editableVariants.map((v, i) => (
              <div key={i} className="cb-proposal-variant">
                <div className="cb-proposal-variant-bar"></div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--secondary)' }}>Variant {v.variantId || String.fromCharCode(65 + i)}</span>
                  <textarea
                    className="cb-textarea"
                    style={{ marginTop: '4px', width: '100%', minHeight: '60px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--outline-variant)', fontSize: '14px', lineHeight: '20px' }}
                    value={v.template || v.subject || ''}
                    onChange={(e) => handleVariantChange(i, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cb-proposal-actions">
        <button 
          onClick={onDiscard}
          className="cb-btn-discard"
        >
          Discard
        </button>
        <button 
          onClick={() => onApprove({ ...proposal, variants: editableVariants })}
          className="cb-btn-approve"
        >
          Approve & Save
        </button>
      </div>
    </div>
  );
};

export default function Chatbot() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleApproveAndSave = async (proposalData) => {
    try {
      const response = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'DRAFT',
          name: proposalData.name,
          goal: proposalData.goal,
          segmentDescription: proposalData.segmentQuery?.semanticQuery || 'Generated segment',
          segmentQuery: proposalData.segmentQuery,
          variants: proposalData.variants
        })
      });

      const data = await response.json();
      
      if (data.success && data.campaign) {
        navigate(`/campaigns/${data.campaign._id}`);
      }
    } catch (error) {
      console.error("Failed to save approved campaign:", error);
    }
  };

  const handleDiscard = () => {
    setMessages(prev => [...prev, { role: 'system', content: 'Campaign proposal discarded.' }]);
  };

  const renderMessage = (message) => {
    if (message.role === 'user') {
      return (
        <div className="cb-msg-row-user">
          <div className="cb-msg-bubble-user">
            {message.content}
          </div>
          <span className="cb-msg-label-user">You</span>
        </div>
      );
    }

    if (message.role === 'system') {
        return (
            <div className="cb-msg-row-system">
                <span className="cb-msg-system-text">{message.content}</span>
            </div>
        );
    }

    const proposalRegex = /\[CAMPAIGN_PROPOSAL:\s*(\{[\s\S]*\})\s*\]/;
    const match = message.content?.match(proposalRegex);

    if (match) {
      try {
        const proposalData = JSON.parse(match[1]); 
        const textBefore = message.content.split(match[0])[0].trim();

        return (
          <div className="cb-msg-row-ai">
            <div className="cb-msg-header-ai">
                <span className="cb-msg-name-ai">Cortana</span>
            </div>
            {textBefore && (
              <div className="cb-msg-bubble-ai">
                {textBefore}
              </div>
            )}
            <CampaignProposalCard 
              proposal={proposalData} 
              onApprove={(data) => handleApproveAndSave(data)}
              onDiscard={() => handleDiscard()}
            />
          </div>
        );
      } catch (error) {
        console.error("[Chatbot Error] Failed to parse proposal JSON:", error, "Raw match:", match[1]);
        return (
          <div className="cb-msg-row-ai">
            <p>⚠️ The AI generated a campaign proposal, but the data was corrupted. Please try again.</p>
            <pre style={{fontSize: '10px', background: '#eee', padding: '8px', overflow: 'auto', maxWidth: '100%'}}>
                {match[1]}
            </pre>
          </div>
        );
      }
    }

    return (
        <div className="cb-msg-row-ai">
            <div className="cb-msg-header-ai">
                <span className="cb-msg-name-ai">Cortana</span>
            </div>
            <div className="cb-msg-bubble-ai">
                {message.content}
            </div>
        </div>
    );
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev, data.message]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Error: ${data.error || 'Failed to communicate with AI model'}` }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ Network Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="cb-container">
      <main className="cb-main">
        {/* Left Panel: Conversation History */}
        <aside className="cb-sidebar">
          <header className="cb-sidebar-header">
            <h1 className="cb-sidebar-title">AI Assistant</h1>
            <p className="cb-sidebar-subtitle">Ask anything about your CRM</p>
          </header>
          
          <div className="cb-quick-actions">
            <button onClick={() => setInput("Generate segment for high value users")} className="cb-btn-outline">Generate segment</button>
            <button onClick={() => setInput("Campaign ROI")} className="cb-btn-outline">Campaign ROI</button>
            <button onClick={() => setInput("Summarize leads")} className="cb-btn-outline">Summarize leads</button>
          </div>

          <div className="cb-thread-list custom-scrollbar">
             <div>
               <h3 className="cb-thread-group-title">Today</h3>
               <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                 <div className="cb-thread-item">
                    <div className="cb-thread-header">
                        <span className="cb-thread-title">Active Thread</span>
                        <span className="cb-thread-time">Just now</span>
                    </div>
                    <p className="cb-thread-preview">Current conversation</p>
                 </div>
               </div>
             </div>
          </div>

          <button onClick={() => setMessages([])} className="cb-new-btn">
            <span className="material-symbols-outlined">add</span>
            New Conversation
          </button>
        </aside>

        {/* Right Panel: Active Chat */}
        <section className="cb-chat-area">
          {/* Top Bar */}
          <header className="cb-header">
            <div className="cb-header-left">
              <input className="cb-title-input" type="text" value="Cortana Chat" readOnly />
              <span className="cb-badge">
                Cortana · RAG Mode
              </span>
            </div>
            <div>
                <button onClick={() => setMessages([])} className="cb-icon-btn" title="Clear Chat">
                  <span className="material-symbols-outlined">delete</span>
                </button>
            </div>
          </header>

          {/* Message Area */}
          <div className="cb-messages-container custom-scrollbar">
            {messages.length === 0 ? (
                <div className="cb-empty-state">
                    How can I help you orchestrate your campaigns today?
                </div>
            ) : (
                messages.map((m, i) => (
                <div key={i}>
                    {renderMessage(m)}
                </div>
                ))
            )}
            
            {isLoading && (
              <div className="cb-typing-indicator">
                <div className="cb-typing-icon">
                    <span className="material-symbols-outlined cb-text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>spark</span>
                </div>
                <div className="cb-typing-dots">
                    <div className="cb-dot"></div>
                    <div className="cb-dot"></div>
                    <div className="cb-dot"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Section */}
          <div className="cb-input-section">
            <div className="cb-input-wrapper">
              <div className="cb-input-left">
                <button className="cb-icon-btn">
                  <span className="material-symbols-outlined">mic</span>
                </button>
              </div>
              <textarea 
                className="cb-textarea" 
                placeholder="Type your message here..." 
                rows="1"
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = (e.target.scrollHeight) + 'px';
                  if (e.target.scrollHeight > 150) {
                      e.target.style.overflowY = 'auto';
                  }
                }}
                onKeyDown={handleKeyDown}
              ></textarea>
              <div className="cb-input-right">
                <button className="cb-icon-btn">
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <button 
                  onClick={handleSend}
                  disabled={isLoading}
                  className="cb-send-btn"
                >
                  <span className="material-symbols-outlined">arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
