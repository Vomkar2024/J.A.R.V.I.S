import React, { useEffect, useRef } from 'react';
import './css/BrainTerminal.css';

/**
 * BrainTerminal Component
 * The advanced communication hub for J.A.R.V.I.S.
 * Displays real-time streaming AI responses and conversation history.
 */
const BrainTerminal = ({ streamingText, aiResponse, isThinking, conversationHistory, isVisible, pipelineState }) => {
  const scrollRef = useRef(null);

  // Auto-scroll when new content appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, aiResponse, conversationHistory, isThinking]);

  if (!isVisible) return null;

  // Get the last few messages to display
  const recentMessages = conversationHistory.slice(-10);

  return (
    <div className="brain-terminal">
      <div className="terminal-header">
        <div className="header-top">
          <span className="terminal-title">J.A.R.V.I.S NEURAL LINK</span>
          <div className="header-controls">
            <span className="control-dot"></span>
            <span className="control-dot active"></span>
            <span className="control-dot"></span>
          </div>
        </div>
        <div className="header-bottom">
          <div className={`status-indicator ${isThinking ? 'thinking' : pipelineState === 'speaking' ? 'speaking' : 'active'}`}>
            <div className="status-circle"></div>
            <span className="status-label">
              {isThinking ? 'NEURAL_PROCESSING' : pipelineState === 'speaking' ? 'VOICE_OUTPUT' : 'STABLE_CONNECTION'}
            </span>
          </div>
        </div>
      </div>

      <div className="terminal-body" ref={scrollRef}>
        {/* Conversation History */}
        {recentMessages.map((msg, index) => (
          <div key={index} className={`message-segment ${msg.role}`}>
            <div className="segment-label">
              {msg.role === 'user' ? '⟩ USER_INPUT' : '⟩ JARVIS_RESPONSE'}
              <span className="timestamp">
                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
              </span>
            </div>
            <p className={`message-text ${msg.role}`}>{msg.text}</p>
          </div>
        ))}

        {/* Streaming Text (real-time tokens) */}
        {streamingText && (
          <div className="message-segment assistant streaming">
            <div className="segment-label">⟩ JARVIS_RESPONSE <span className="live-badge">LIVE</span></div>
            <p className="message-text assistant">
              {streamingText}
              <span className="cursor-blink">▊</span>
            </p>
          </div>
        )}

        {/* Thinking Waveform */}
        {isThinking && !streamingText && (
          <div className="thinking-waveform">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <span className="processing-note">ACCESSING_MEMORY_BANKS...</span>
          </div>
        )}
      </div>

      <div className="terminal-footer">
        <div className="matrix-bg"></div>
        <span className="footer-stat">ENGINE: LLAMA-3.1-8B</span>
        <span className="footer-stat">MODE: {pipelineState?.toUpperCase() || 'IDLE'}</span>
      </div>
    </div>
  );
};

export default BrainTerminal;
