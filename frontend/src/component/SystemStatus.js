import React, { useState, useCallback } from 'react';
import './css/SystemStatus.css';

/**
 * SystemStatus Component
 * A futuristic, HUD-style status bar that displays the real-time state 
 * of the J.A.R.V.I.S subsystems. Now with a single unified scanline.
 */
const SystemStatus = ({ isListening, isProcessing, isSupported, permissionGranted, showHero }) => {
  // Default to retracted as requested
  const [isRetracted, setIsRetracted] = useState(true);
  const isNeuralActive = typeof window.puter !== 'undefined';
  const toggleHUD = useCallback(() => setIsRetracted(prev => !prev), []);

  return (
    <div className={`system-status-container ${isRetracted ? 'retracted' : 'expanded'} ${showHero ? 'hidden' : ''}`}>
      
      {/* Unified Scanline - Now at the container level for a continuous flow */}
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

          <div className={`status-item ${isNeuralActive ? 'online' : 'error'}`}>
            <span className="item-label">NEURAL_AI</span>
            <span className="item-value">{isNeuralActive ? (isProcessing ? 'PROCESSING' : 'READY') : 'DISCONNECTED'}</span>
          </div>

          <div className={`status-item ${isSupported && permissionGranted ? 'granted' : 'denied'}`}>
            <span className="item-label">SECURITY</span>
            <span className="item-value">{isSupported && permissionGranted ? 'AUTHORIZED' : 'RESTRICTED'}</span>
          </div>

          <div className="status-item online">
            <span className="item-label">BRAIN_LINK</span>
            <span className="item-value">ESTABLISHED</span>
          </div>
        </div>
      </div>
      
      <div className="hud-edge-accent top"></div>
    </div>
  );
};

export default SystemStatus;
