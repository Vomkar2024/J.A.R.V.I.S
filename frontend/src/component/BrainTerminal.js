import React, { useState, useEffect, useRef } from 'react';
import './BrainTerminal.css';

/**
 * BrainTerminal Component
 * The advanced communication hub for J.A.R.V.I.S.
 * It displays real-time AI responses, thinking states, and translations.
 */
const BrainTerminal = ({ aiResponse, isThinking, translationData, isVisible }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentLine, setCurrentLine] = useState(0);
  const scrollRef = useRef(null);

  // Typing effect for AI response
  useEffect(() => {
    if (aiResponse) {
      setDisplayText('');
      let i = 0;
      const interval = setInterval(() => {
        setDisplayText(aiResponse.slice(0, i + 1));
        i++;
        if (i >= aiResponse.length) {
          clearInterval(interval);
        }
      }, 25);
      return () => clearInterval(interval);
    }
  }, [aiResponse]);

  // Auto-scroll when new text appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayText, isThinking]);

  if (!isVisible && !isThinking) return null;

  return (
    <div className="brain-terminal">
      <div className="terminal-header">
        <div className="header-top">
          <span className="terminal-id">LOG_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
          <div className="terminal-actions">
            <span className="action-btn">_</span>
            <span className="action-btn">□</span>
            <span className="action-btn">×</span>
          </div>
        </div>
        <div className="header-bottom">
          <div className={`status-indicator ${isThinking ? 'thinking' : 'active'}`}>
            <div className="status-circle"></div>
            <span className="status-label">{isThinking ? 'NEURAL_LINK_PROCESSING' : 'STABLE_CONNECTION'}</span>
          </div>
          <span className="protocol-version">CORE_V4.2</span>
        </div>
      </div>

      <div className="terminal-body" ref={scrollRef}>
        {/* Thinking Waveform */}
        {isThinking && (
          <div className="thinking-waveform">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <span className="processing-note">ACCESSING_MEMORY_BANKS...</span>
          </div>
        )}

        {/* Translation Data (If applicable) */}
        {translationData && !aiResponse && (
          <div className="translation-segment">
            <div className="segment-label">TRANS_LOG // {translationData.detectedLang}</div>
            <p className="original-speech">{translationData.originalText}</p>
            <div className="arrow-down">▼</div>
            <p className="translated-speech">{translationData.translatedText}</p>
          </div>
        )}

        {/* AI Main Response */}
        {aiResponse && (
          <div className="ai-response-segment">
            <div className="segment-label">JARVIS_RESPONSE // EN-US</div>
            <p className="response-text">
              <span className="prompt-char">{'>'}</span> {displayText}
              <span className="cursor">|</span>
            </p>
          </div>
        )}
      </div>

      <div className="terminal-footer">
        <div className="matrix-bg"></div>
        <span className="footer-stat">LATENCY: 42ms</span>
        <span className="footer-stat">TOKENS: {Math.floor(Math.random() * 500) + 100}/MIN</span>
      </div>
    </div>
  );
};

export default BrainTerminal;
