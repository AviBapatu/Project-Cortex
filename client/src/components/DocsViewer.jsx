import React, { useState, memo, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DocsViewer.css';

import blueprintDoc from '../../../docs/blueprint.md?raw';
import shoppersDoc from '../../../docs/features/shoppers.md?raw';
import commandCenterDoc from '../../../docs/features/command-center.md?raw';
import campaignsDoc from '../../../docs/features/campaigns.md?raw';
import mabEngineDoc from '../../../docs/features/mab-engine.md?raw';
import cortanaDoc from '../../../docs/features/cortana.md?raw';

const SECTIONS = {
  "System Blueprint": blueprintDoc,
  "Hybrid Search & Shoppers": shoppersDoc,
  "Command Center UI": commandCenterDoc,
  "Campaign Generation": campaignsDoc,
  "MAB Execution Engine": mabEngineDoc,
  "Cortana AI Security": cortanaDoc
};

const MemoizedMarkdown = memo(({ content }) => {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default function DocsViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("System Blueprint");
  
  const containerRef = useRef(null);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);

  const sectionTitles = Object.keys(SECTIONS);

  useEffect(() => {
    if (!isOpen) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.getAttribute('data-id'));
          }
        });
      },
      {
        root: containerRef.current,
        threshold: 0.5 
      }
    );

    const slides = document.querySelectorAll('.docs-slide');
    slides.forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, [isOpen]);

  const scrollToSection = (id) => {
    const target = document.querySelector(`.docs-slide[data-id="${id}"]`);
    if (target && containerRef.current) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  return (
    <>
      <button 
        className="docs-fab" 
        onClick={toggleOpen}
        title="View Documentation"
      >
        <span className="material-symbols-outlined">menu_book</span>
      </button>

      <div className={`docs-overlay ${isOpen ? 'is-open' : 'is-closed'}`} onClick={closeDrawer} />

      <div className={`docs-drawer ${isOpen ? 'is-open' : 'is-closed'}`}>
        <div className="docs-drawer-content">
          
          <div className="docs-left-pane">
            <h3 className="toc-title">Documentation</h3>
            <nav className="toc-nav">
              {sectionTitles.map((title) => (
                <button
                  key={title}
                  className={`toc-tab-btn ${activeSection === title ? 'active' : ''}`}
                  onClick={() => scrollToSection(title)}
                >
                  {title}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="docs-right-pane custom-scrollbar" ref={containerRef}>
            {sectionTitles.map((title) => (
              <div className="docs-slide" key={title} data-id={title}>
                <div className="docs-slide-inner">
                  <MemoizedMarkdown content={SECTIONS[title]} />
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </>
  );
}
