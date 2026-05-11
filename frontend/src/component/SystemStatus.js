import React, { useState, useCallback, useEffect } from 'react';
import './css/SystemStatus.css';

/**
 * SystemStatus Component
 * A futuristic, HUD-style status bar that displays the real-time state 
 * of the J.A.R.V.I.S subsystems. Uses WebSocket connection status.
 */
const SystemStatus = ({ isListening, isThinking, isSpeaking, isSupported, permissionGranted, showHero, isBackendConnected, pipelineState, telemetry }) => {
  const [isRetracted, setIsRetracted] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  
  // Auto-expand HUD during the splash/hero sequence
  // Auto-expand HUD and show it after the hero sequence
  useEffect(() => {
    if (!showHero) {
      // Delay expansion slightly for a smooth transition after hero fades
      const timer = setTimeout(() => {
        setIsVisible(true);
        setIsRetracted(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setIsRetracted(true);
    }
  }, [showHero]);

  const toggleHUD = useCallback(() => setIsRetracted(prev => !prev), []);

  // Determine pipeline display
  const getPipelineDisplay = () => {
    switch (pipelineState) {
      case 'thinking': return 'PROCESSING';
      case 'speaking': return 'SPEAKING';
      case 'listening': return 'LISTENING';
      case 'observing': return 'OBSERVING';
      default: return isListening ? 'READY' : 'STANDBY';
    }
  };

  // Logic to "connect these 2 during that splash screen"
  // NEURAL_AI and WS_LINK will show as ONLINE/STABLE while showHero is active
  const neuralAiStatus = (isBackendConnected || showHero) ? 'online' : 'error';
  const neuralAiValue = (isBackendConnected || showHero) ? (isBackendConnected ? getPipelineDisplay() : 'SYNCING...') : 'DISCONNECTED';
  
  const wsLinkStatus = (isBackendConnected || showHero) ? 'online' : 'error';
  const wsLinkValue = (isBackendConnected || showHero) ? 'STABLE' : 'LINK_LOST';

  return (
    <div className={`system-status-container ${isRetracted ? 'retracted' : 'expanded'} ${!isVisible ? 'hidden' : 'visible'}`}>
      
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

          {pipelineState === 'observing' && (
            <div className="status-item warning">
              <span className="item-label">OPTICAL_SENSE</span>
              <span className="item-value pulse">ACTIVE</span>
            </div>
          )}

          <div className={`status-item ${telemetry?.status === 'critical' ? 'error' : 'online'}`}>
            <span className="item-label">CPU_LOAD</span>
            <span className="item-value">{telemetry?.cpu || 0}%</span>
          </div>

          <div className="status-item online">
            <span className="item-label">MEM_USE</span>
            <span className="item-value">{telemetry?.ram || 0}%</span>
          </div>

          <div className={`status-item ${neuralAiStatus}`}>
            <span className="item-label">NEURAL_AI</span>
            <span className="item-value">{neuralAiValue}</span>
          </div>

          <div className={`status-item ${isSupported && permissionGranted ? 'granted' : 'denied'}`}>
            <span className="item-label">SECURITY</span>
            <span className="item-value">{isSupported && permissionGranted ? 'AUTHORIZED' : 'RESTRICTED'}</span>
          </div>

          <div className={`status-item ${wsLinkStatus}`}>
            <span className="item-label">WS_LINK</span>
            <span className="item-value">{wsLinkValue}</span>
          </div>
        </div>
      </div>
      
      <div className="hud-edge-accent top"></div>
    </div>
  );
};

export default SystemStatus;
