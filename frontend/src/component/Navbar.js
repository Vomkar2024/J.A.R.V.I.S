import React, { useState, useCallback, useEffect, useRef } from 'react';
import 'component/css/Navbar.css';

/**
 * Navbar Component
 * This is the main navigation bar at the top of the screen.
 * It contains the logo, settings menu, and volume visualizer.
 */
function Navbar({ blobSettings, setBlobSettings, onSave, onReset, showHero, isListening, onInitialize, onStop }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        handleCloseMenu();
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, handleCloseMenu]);

  const handleOpenMenu = useCallback(() => {
    setIsMenuOpen(true);
    setIsClosing(false);
    setBlobSettings(prev => ({ ...prev, position: { x: 85, y: 85 }, size: 0.5 }));
  }, [setBlobSettings]);

  const handleCloseMenu = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMenuOpen(false);
      setIsClosing(false);
      // When settings close, the AI blob returns to center
      setBlobSettings(prev => ({ ...prev, position: { x: 50, y: 50 }, size: 0.8 }));
    }, 500); // Wait for the retraction animation
  }, [setBlobSettings]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setBlobSettings(prev => ({
      ...prev,
      [name]: name === 'color' ? value : parseFloat(value)
    }));
  }, [setBlobSettings]);

  return (
    <nav className={`navbar ${showHero ? 'hidden' : ''}`}>
      <div className="nav-container">
        {/* J.A.R.V.I.S Logo and Status */}
        <div className="nav-brand">
          <div className="logo-glow"></div>
          <h1 className="nav-title">J.A.R.V.I.S</h1>
          <div className="status-indicator">
            <span className={`pulse ${isListening ? 'active' : ''}`}></span>
            <span className="status-text">{isListening ? 'SYSTEM_ACTIVE' : 'SYSTEM_STANDBY'}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="nav-controls">
          <button 
            className={`action-btn ${isListening ? 'active' : ''}`}
            onClick={isListening ? onStop : onInitialize}
          >
            {isListening ? 'STOP_LINK' : 'INITIALIZE_LINK'}
            <div className="btn-border"></div>
          </button>

          <button className="settings-toggle" onClick={handleOpenMenu}>
            <span className="settings-icon">⚙</span>
          </button>
        </div>
      </div>

      {/* Futuristic Retractable Settings Menu */}
      {isMenuOpen && (
        <div className={`settings-overlay ${isClosing ? 'closing' : ''}`}>
          <div className={`settings-menu ${isClosing ? 'retract' : 'expand'}`} ref={menuRef}>
            <div className="menu-header">
              <h2>SYSTEM_CONFIG</h2>
              <button className="close-btn" onClick={handleCloseMenu}>×</button>
            </div>
            
            <div className="menu-body">
              <div className="setting-group">
                <label>NEURAL_COLOR</label>
                <div className="color-picker-wrapper">
                  <input type="color" name="color" value={blobSettings.color} onChange={handleChange} />
                  <span className="color-value">{blobSettings.color.toUpperCase()}</span>
                </div>
              </div>

              <div className="setting-group">
                <label>CORE_SCALE</label>
                <input type="range" name="size" min="0.3" max="2" step="0.1" value={blobSettings.size} onChange={handleChange} />
                <span className="range-value">{Math.round(blobSettings.size * 100)}%</span>
              </div>

              <div className="setting-group">
                <label>MIC_SENSITIVITY</label>
                <input type="range" name="sensitivity" min="0.1" max="2" step="0.1" value={blobSettings.sensitivity} onChange={handleChange} />
                <span className="range-value">{blobSettings.sensitivity}x</span>
              </div>

              <div className="menu-actions">
                <button className="save-btn" onClick={onSave}>COMMIT_CHANGES</button>
                <button className="reset-btn" onClick={onReset}>RESET_DEFAULTS</button>
              </div>
            </div>

            <div className="menu-footer">
              <span className="serial-no">SN: 884-JAR-01</span>
              <span className="version">V4.0.2</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
