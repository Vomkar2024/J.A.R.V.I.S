import React from 'react';
import './css/TranslationTerminal.css';

/**
 * TranslationTerminal Component
 * This component appears on the right side of the screen when a non-English
 * language is detected. It shows the original text and its English translation.
 */
const TranslationTerminal = ({ translationData, isVisible }) => {
  if (!isVisible || !translationData) return null;

  return (
    <div className="translation-terminal">
      <div className="terminal-header">
        <div className="terminal-header-top">
          <span className="terminal-title">Neural Translator</span>
          <div className="terminal-controls">
            <span className="control-dot red"></span>
            <span className="control-dot yellow"></span>
            <span className="control-dot green"></span>
          </div>
        </div>
        <div className="terminal-status">
          <span className="pulse-dot"></span>
          <span className="status-text">DECODING SIGNAL...</span>
        </div>
      </div>
      
      <div className="terminal-content">
        <div className="translation-group">
          <div className="label-row">
            <span className="lang-tag">SRC: {translationData.detectedLang || 'AUTO'}</span>
            <span className="timestamp">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
          </div>
          <div className="original-text-container">
             <p className="original-text">{translationData.originalText}</p>
          </div>
        </div>

        <div className="terminal-divider">
          <div className="line"></div>
          <div className="glitch-icon">⚡</div>
          <div className="line"></div>
        </div>

        <div className="translation-group">
          <div className="label-row">
            <span className="lang-tag target">TRG: EN-US</span>
            <span className="accuracy">MATCH: 98.4%</span>
          </div>
          <div className="translated-text-container">
            <p className="translated-text">{translationData.translatedText}</p>
          </div>
        </div>
      </div>

      <div className="terminal-footer">
        <div className="scanning-line"></div>
        <span className="footer-code">J.A.R.V.I.S_V3.0_TL88</span>
      </div>
    </div>
  );
};

export default TranslationTerminal;
