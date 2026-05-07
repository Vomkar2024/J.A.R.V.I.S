import React, { useState, useCallback } from 'react';
import './css/SystemStatus.css';

/**
 * SystemStatus Component
 * A futuristic, HUD-style status bar that displays the real-time state 
 * of the J.A.R.V.I.S subsystems. Uses WebSocket connection status.
 */
const SystemStatus = ({ isListening, isThinking, isSpeaking, isSupported, permissionGranted, showHero, isBackendConnected, pipelineState }) => {
  const [isRetracted, setIsRetracted] = useState(true);
  const toggleHUD = useCallback(() => setIsRetracted(prev => !prev), []);

  // Determine pipeline display
  const getPipelineDisplay = () => {
    switch (pipelineState) {
      case 'thinking': return 'PROCESSING';
      case 'speaking': return 'SPEAKING';
      case 'listening': return 'LISTENING';
      default: return isListening ? 'READY' : 'STANDBY';
    }
  };

  return (
    <div className={`system-status-container ${isRetracted ? 'retracted' : 'expanded'} ${showHero ? 'hidden' : ''}`}>
      
      {/* Unified Scanline */}
      <div className="unified-scanning-glow"></div>

      {/* Toggle Button */}
      <button 
        className="hud-toggle" 
        onClick={toggleHUD}
        title={isRetracted ? "Expand HUD" : "Retract HUD"}
      >
        <span className="toggle-icon">{'<'}</span>
      </button>

      {/* Main Status Bar */}
      <div className="sci-fi-bar">
        <div className="status-items">
          <div className={`status-item ${isListening ? 'online' : 'offline'}`}>
            <span className="item-label">CORE_SYS</span>
            <span className="item-value">{isListening ? 'ONLINE' : 'STANDBY'}</span>
          </div>

          <div className={`status-item ${isListening ? 'active' : 'inactive'}`}>
            <span className="item-label">MIC_LINK</span>
            <span className="item-value">{isListening ? 'STREAMING' : 'MUTED'}</span>
          </div>

          <div className={`status-item ${isBackendConnected ? 'online' : 'error'}`}>
            <span className="item-label">NEURAL_AI</span>
            <span className="item-value">{isBackendConnected ? getPipelineDisplay() : 'DISCONNECTED'}</span>
          </div>

          <div className={`status-item ${isSupported && permissionGranted ? 'granted' : 'denied'}`}>
            <span className="item-label">SECURITY</span>
            <span className="item-value">{isSupported && permissionGranted ? 'AUTHORIZED' : 'RESTRICTED'}</span>
          </div>

          <div className={`status-item ${isBackendConnected ? 'online' : 'error'}`}>
            <span className="item-label">WS_LINK</span>
            <span className="item-value">{isBackendConnected ? 'ESTABLISHED' : 'LINK_LOST'}</span>
          </div>
        </div>
      </div>
      
      <div className="hud-edge-accent top"></div>
    </div>
  );
};

export default SystemStatus;
