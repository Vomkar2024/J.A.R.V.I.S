import React, { useEffect, useRef } from 'react';
import './css/BrainTerminal.css';
import { STATUS_LABELS } from '../constants';

/**
 * Utility to parse URLs and render them as clickable anchor tags.
 */
const renderMessageWithLinks = (text) => {
  if (!text) return '';
  // Match standard URLs (http/https) or www. links
  const urlRegex = /(https?:\/\/[^\s\+]+|www\.[^\s\+]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="terminal-link"
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

/**
 * BrainTerminal Component
 * The advanced communication hub for J.A.R.V.I.S.
 * Displays real-time streaming AI responses and conversation history.
 */
const BrainTerminal = ({ streamingText, aiResponse, isThinking, conversationHistory, isVisible, pipelineState, activeTool, onSendMessage }) => {
  const scrollRef = useRef(null);

  // Auto-scroll when new content appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText, aiResponse, conversationHistory, isThinking]);

  if (!isVisible) return null;


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
              {isThinking ? STATUS_LABELS.THINKING : 
               pipelineState === 'speaking' ? STATUS_LABELS.SPEAKING : 
               pipelineState === 'memory_access' ? STATUS_LABELS.MEMORY : 
               pipelineState === 'observing' ? STATUS_LABELS.OBSERVING :
               pipelineState === 'tool_use' ? `TOOL_${activeTool}` :
               STATUS_LABELS.IDLE}
            </span>
          </div>
        </div>
      </div>

      <div className="terminal-body" ref={scrollRef}>
        {/* Full Scrollable Conversation History */}
        {conversationHistory.map((msg, index) => (
          <div key={index} className={`message-segment ${msg.role}`}>
            <div className="segment-label">
              {msg.role === 'user' ? '⟩ USER_INPUT' : '⟩ JARVIS_RESPONSE'}
              <span className="timestamp">
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}) : ''}
              </span>
            </div>
            <p className={`message-text ${msg.role}`}>
              {renderMessageWithLinks(msg.text)}
            </p>
          </div>
        ))}

        {/* Streaming Text (real-time tokens) */}
        {streamingText && (
          <div className="message-segment assistant streaming">
            <div className="segment-label">⟩ JARVIS_RESPONSE <span className="live-badge">LIVE</span></div>
            <p className="message-text assistant">
              {renderMessageWithLinks(streamingText)}
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
        <form className="terminal-input-form" onSubmit={(e) => {
          e.preventDefault();
          const input = e.target.elements.terminalInput;
          if (input && input.value.trim()) {
            if (onSendMessage) {
              onSendMessage(input.value);
            }
            input.value = '';
          }
        }}>
          <span className="input-prompt">⟩</span>
          <input 
            name="terminalInput"
            type="text" 
            className="terminal-input" 
            placeholder="Type a command..." 
            autoComplete="off"
          />
        </form>
        <div className="footer-stats">
          <span className="footer-stat">ENGINE: LLAMA-3.1-8B</span>
          <span className="footer-stat">MODE: {pipelineState?.toUpperCase() || 'IDLE'}</span>
        </div>
      </div>
    </div>
  );
};

export default BrainTerminal;
