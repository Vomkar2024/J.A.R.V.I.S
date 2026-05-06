import React, { useState, useCallback, useEffect, useRef } from 'react';
import './css/Navbar.css';

/**
 * Navbar Component
 * Restored to the version shown in the user's latest screenshot.
 * Includes HOME, CORE, NEXUS, SETTINGS links and a streamlined INITIALIZE button.
 */
function Navbar({ blobSettings, setBlobSettings, onSave, onReset, showHero, isListening, onInitialize, onStop }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const handleToggleMenu = useCallback((e) => {
    e.preventDefault();
    setIsMenuOpen(prev => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

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

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setBlobSettings(prev => ({
      ...prev,
      [name]: name === 'color' ? value : parseFloat(value)
    }));
  }, [setBlobSettings]);

  return (
    <nav className={`navbar ${showHero ? 'hidden' : ''}`}>
      <div className="nav-logo" onClick={() => window.location.reload()}>
        J.A.R.V.I.S
      </div>

      <ul className="nav-links">
        <li className="nav-item"><a href="#home" className="nav-link">HOME</a></li>
        <li className="nav-item"><a href="#core" className="nav-link">CORE</a></li>
        <li className="nav-item"><a href="#nexus" className="nav-link">NEXUS</a></li>
        <li className="nav-item" style={{ position: 'relative' }}>
          <a href="#settings" className="nav-link" onClick={handleToggleMenu}>SETTINGS</a>
          {isMenuOpen && (
            <div className="settings-panel" ref={menuRef}>
              <h2 className="settings-title">SYSTEM_CONFIG</h2>

              <div className="settings-group">
                <div className="label-with-value">
                  <label>NEURAL_COLOR</label>
                  <span className="setting-value">{blobSettings.color.toUpperCase()}</span>
                </div>
                <input type="color" name="color" value={blobSettings.color} onChange={handleChange} />
              </div>

              <div className="settings-group">
                <div className="label-with-value">
                  <label>CORE_SCALE</label>
                  <span className="setting-value">{Math.round(blobSettings.size * 100)}%</span>
                </div>
                <input type="range" name="size" min="0.3" max="2" step="0.1" value={blobSettings.size} onChange={handleChange} />
              </div>

              <div className="settings-group">
                <div className="label-with-value">
                  <label>MIC_SENSITIVITY</label>
                  <span className="setting-value">{blobSettings.sensitivity}x</span>
                </div>
                <input type="range" name="sensitivity" min="0.1" max="2" step="0.1" value={blobSettings.sensitivity} onChange={handleChange} />
              </div>

              <div className="settings-actions">
                <button className="btn-save" onClick={() => { onSave(); handleCloseMenu(); }}>SAVE CHANGES</button>
                <button className="btn-reset" onClick={onReset}>RESET</button>
              </div>
            </div>
          )}
        </li>
      </ul>

      <div className="nav-actions">
        <button
          className={`btn-launch ${isListening ? 'listening' : ''}`}
          onClick={isListening ? onStop : onInitialize}
        >
          {isListening ? 'STOP' : 'INITIALIZE'}
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
