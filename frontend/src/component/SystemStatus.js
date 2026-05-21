import React, { useState, useCallback, useEffect } from 'react';
import './css/SystemStatus.css';

/**
 * SystemStatus Component
 * A futuristic, HUD-style status bar that displays the real-time state 
 * of the J.A.R.V.I.S subsystems. Uses WebSocket connection status.
 */
const SystemStatus = ({ isListening, isThinking, isSpeaking, isSupported, permissionGranted, showHero, isBackendConnected, pipelineState, activeTool, telemetry, forceExpand }) => {
  const [isRetracted, setIsRetracted] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  
  // Auto-expand HUD during the splash/hero sequence
  // Auto-expand HUD and show it after the hero sequence
  useEffect(() => {
    if (!showHero) {
      // Delay expansion slightly for a smooth transition after hero fades
      const timer = setTimeout(() => {
        setIsVisible(true);
        if (forceExpand) setIsRetracted(false);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setIsRetracted(true);
    }
  }, [showHero, forceExpand]);

  const toggleHUD = useCallback(() => setIsRetracted(prev => !prev), []);

  // Determine pipeline display
  const getPipelineDisplay = () => {
    switch (pipelineState) {
      case 'thinking': return 'PROCESSING';
      case 'speaking': return 'SPEAKING';
      case 'listening': return 'LISTENING';
      case 'observing': return 'OBSERVING';
      case 'tool_use': return activeTool || 'TASKING';
      default: return isListening ? 'READY' : 'STANDBY';
    }
  };

  // WS_LINK should reflect the actual backend connection state
  const neuralAiStatus = isBackendConnected ? 'online' : 'error';
  const neuralAiValue = isBackendConnected ? getPipelineDisplay() : 'DISCONNECTED';
  
  const wsLinkStatus = isBackendConnected ? 'online' : 'error';
  const wsLinkValue = isBackendConnected ? 'STABLE' : 'LINK_LOST';

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
